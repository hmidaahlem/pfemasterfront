import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,//rend un élément déplaçable
  CdkDragDrop,//événement du déplacement
  CdkDragPlaceholder,
  CdkDropList,//zone qui reçoit les éléments
  CdkDropListGroup,//connecte plusieurs listes
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { InternalOrder, Category, Product } from '../../core/models';
import { PageLoadingComponent } from '../../shared/page-loading/page-loading.component';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

interface CartItem {
  product: Product;
  quantity: number;
}
@Component({
  selector: 'app-internal-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageLoadingComponent,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder
  ],
  templateUrl: './internal-orders.component.html',
  styleUrl: './internal-orders.component.scss'
})
export class InternalOrdersComponent implements OnInit {


  orders: InternalOrder[] = [];
  loading = true;
  activeTab: 'incoming' | 'outgoing' = 'incoming';

  showViewModal = false;
  showCreateModal = false;
  selectedOrder: InternalOrder | null = null;

  wizardStep = 1;
  steps = [
    { n: 1, label: 'Type' },
    { n: 2, label: 'Sélection & Quantités' },
    { n: 3, label: 'Date & Notes' },
  ];

  form: any = { type: '', notes: '', delivery_date: '', pdv_id: '' };

  categories: Category[] = [];
  filteredCategories: Category[] = [];
  selectedCategories: Category[] = [];
  loadingCategories = false;

  availableProducts: Product[] = [];
  loadingProducts = false;

  cart: CartItem[] = [];
  saving = false;
  saveError = '';

  comments: any[] = [];
  newComment = '';
  loadingComments = false;
  editingCommentId: number | null = null;
  editCommentText = '';

  currentUser: any;
  userRole = '';
  pdvs: any[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
    this.userRole = this.currentUser?.role?.name || '';
    this.load();
    if (this.userRole === 'RESPONSABLE_FB' || this.userRole === 'SUPER_ADMIN') {
      this.loadPdvs();
    }
  }

  loadPdvs(): void {
    this.api.get<any>('points-de-vente').subscribe({
      next: res => this.pdvs = res.data || res,
      error: err => console.error('Error loading PDVs', err)
    });
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('internal-orders').subscribe({
      next: res => this.orders = res.data || res,
      error: () => { this.loading = false; },
      complete: () => { this.loading = false; }
    });
  }

  // FIX 5: Client-side type guard — secondary safety layer on top of the API filter.
  // CHEF_CUISINE sees only 'food' orders; CHEF_MAGASIN sees only 'commercial' orders.
  private get kanbanOrders(): InternalOrder[] {
    if (this.userRole === 'CHEF_CUISINE') {
      return this.orders.filter(o => o.type === 'food');
    }
    if (this.userRole === 'CHEF_MAGASIN') {
      return this.orders.filter(o => o.type === 'commercial');
    }
    return this.orders;
  }

  get outgoingOrders(): InternalOrder[] {
    return this.orders.filter(o => o.created_by === this.currentUser?.id);
  }

  // Kanban getters
  get pendingOrders()     { return this.kanbanOrders.filter(o => o.status === 'EN_ATTENTE'); }
  get partialOrders()     { return this.kanbanOrders.filter(o => o.status === 'PARTIELLEMENT_DISPONIBLE'); }
  get availableOrders()   { return this.kanbanOrders.filter(o => o.status === 'DISPONIBLE'); }
  get unavailableOrders() { return this.kanbanOrders.filter(o => o.status === 'NON_DISPONIBLE'); }

  formatStatus(s: string): string {
    const map: Record<string, string> = {
      'EN_ATTENTE': 'Pending',
      'DISPONIBLE': 'Available',
      'PARTIELLEMENT_DISPONIBLE': 'Partially Ready',
      'NON_DISPONIBLE': 'Not Available'
    };
    return map[s] || s;
  }

  getImgUrl(path: string | undefined | null): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}/storage/${path}`;
  }

  // ─── Wizard ───────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.wizardStep = this.userRole === 'CHEF_CUISINE' ? 2 : 1;
    this.form = { type: this.userRole === 'CHEF_CUISINE' ? 'commercial' : '', notes: '', delivery_date: '', pdv_id: '' };
    this.selectedCategories = [];
    this.availableProducts = [];
    this.cart = [];
    this.saveError = '';
    this.showCreateModal = true;
    if (this.userRole === 'CHEF_CUISINE') {
      this.loadFilteredCategoriesAndProducts();
    }
  }

  getPdvName(id: any): string {
    const pdv = this.pdvs.find(p => p.id == id);
    return pdv ? pdv.name : '-';
  }

  goStep(n: number): void {
    this.wizardStep = n;
    if (n === 2) {
      this.selectedCategories = [];
      this.filteredCategories = [];
      this.loadFilteredCategoriesAndProducts();
    }
  }

  selectType(type: string): void {
    this.form.type = type;
  }

  // Helper getters for step 2
  get displayProducts(): Product[] {
    if (this.selectedCategories.length === 0) {
      return this.availableProducts;
    }
    const selectedIds = this.selectedCategories.map(c => c.id);
    return this.availableProducts.filter(p => p.category_id !== undefined && selectedIds.includes(p.category_id));
  }

  getCartItem(productId: number): CartItem | undefined {
    return this.cart.find(i => i.product.id === productId);
  }

  updateCartItemQty(productId: number, val: number): void {
    const item = this.getCartItem(productId);
    if (item) {
      if (val >= 1) {
        item.quantity = val;
      } else {
        this.removeFromCart(productId);
      }
    }
  }

  // ─── Step 2: Categories & Products ────────────────────────────────────────

  loadFilteredCategoriesAndProducts(): void {
    this.loadingCategories = true;
    this.loadingProducts = true;
    this.api.get<Category[]>('categories').subscribe({
      next: cats => {
        const typeMap: Record<string, string[]> = {
          food: ['food'],
          commercial: ['commercial'],
        };
        const allowed = this.userRole === 'CHEF_CUISINE'
          ? ['matiere_premiere']
          : (typeMap[this.form.type] || []);
        this.filteredCategories = cats.filter(c => allowed.includes(c.type));
        this.loadingCategories = false;

        const payload: any = {};
        if (this.userRole === 'CHEF_CUISINE') {
          payload.type = 'matiere_premiere';
        } else {
          payload.type = this.form.type;
        }

        this.api.post<any>('products/by-categories', payload).subscribe({
          next: (prods: any) => {
            this.availableProducts = prods.data || prods;
            this.loadingProducts = false;
          },
          error: () => {
            this.availableProducts = [];
            this.loadingProducts = false;
          }
        });
      },
      error: () => {
        this.loadingCategories = false;
        this.loadingProducts = false;
      }
    });
  }

  toggleCategory(cat: Category): void {
    const idx = this.selectedCategories.findIndex(c => c.id === cat.id);
    if (idx >= 0) {
      this.selectedCategories.splice(idx, 1);
    } else {
      this.selectedCategories.push(cat);
    }
  }

  isCategorySelected(id: number): boolean {
    return this.selectedCategories.some(c => c.id === id);
  }

  addToCart(product: Product): void {
    if (!this.isInCart(product.id)) {
      this.cart.push({ product, quantity: 1 });
    }
  }

  isInCart(id: number): boolean {
    return this.cart.some(i => i.product.id === id);
  }

  increaseQty(item: CartItem): void { item.quantity++; }
  decreaseQty(item: CartItem): void {
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      this.removeFromCart(item.product.id);
    }
  }
  removeFromCart(id: number): void { this.cart = this.cart.filter(i => i.product.id !== id); }

  // ─── Submit ───────────────────────────────────────────────────────────────

  submitOrder(): void {
    if (!this.form.delivery_date) {
      this.saveError = 'Please select a delivery date.';
      return;
    }
    if ((this.userRole === 'RESPONSABLE_FB' || this.userRole === 'SUPER_ADMIN') && !this.form.pdv_id) {
      this.saveError = 'Please select a Point de Vente.';
      return;
    }
    this.saving = true;
    this.saveError = '';

    const payload = {
      type: this.form.type,
      notes: this.form.notes,
      delivery_date: this.form.delivery_date,
      pdv_id: this.form.pdv_id ? Number(this.form.pdv_id) : null,
      items: this.cart.map(i => ({
        product_id: i.product.id,
        quantity_requested: i.quantity
      }))
    };

    this.api.post('internal-orders', payload).subscribe({
      next: () => {
        this.saving = false;
        this.closeModals();
        this.load();
      },
      error: (err: any) => {
        this.saving = false;
        this.saveError = err.error?.message || 'Une erreur est survenue.';
      }
    });
  }

  // ─── View / Delete / Fulfill ───────────────────────────────────────────────

  viewOrder(o: InternalOrder): void {
    this.selectedOrder = o;
    this.showViewModal = true;
    this.loadComments(o.id);
  }

  closeModals(): void {
    this.showCreateModal = false;
    this.showViewModal = false;
    this.selectedOrder = null;
    this.comments = [];
  }

  deleteOrder(id: number): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:32px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;">
        <div style="font-size:48px;margin-bottom:12px"></div>
        <h3 style="margin:0 0 8px;color:#1a1a2e;font-size:18px">Delete supply order?</h3>
        <p style="margin:0 0 24px;color:#666;font-size:14px">This action cannot be undone.</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="_cancel" style="padding:10px 24px;border:2px solid #D8D2C8;border-radius:8px;background:#fff;cursor:pointer;font-size:14px">Cancel</button>
          <button id="_confirm" style="padding:10px 24px;border:none;border-radius:8px;background:#ef4444;color:#fff;cursor:pointer;font-size:14px">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_cancel')!.addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#_confirm')!.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.api.delete(`internal-orders/${id}`).subscribe(() => this.load());
    });
  }

  saveFulfillment(orderId: number, item: any): void {
    this.api.put(`internal-orders/${orderId}/items/${item.id}/fulfill`, {
      quantity_fulfilled: item.quantity_fulfilled
    }).subscribe({
      next: () => {
        this.load();
        this.api.get<InternalOrder>(`internal-orders/${orderId}`).subscribe(res => {
          this.selectedOrder = res;
        });
      }
    });
  }

  onStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (target && this.selectedOrder) {
      this.updateOrderStatus(this.selectedOrder, target.value);
    }
  }

  updateOrderStatus(order: InternalOrder, status: string): void {
    this.api.put<any>(`internal-orders/${order.id}/status`, { status }).subscribe(() => {
      this.load();
      if (this.selectedOrder && this.selectedOrder.id === order.id) {
        this.selectedOrder.status = status as any;
      }
    });
  }

  // Drag & Drop handler
  drop(event: CdkDragDrop<InternalOrder[]>): void {
    if (event.previousContainer !== event.container) {
      const order = event.item.data as InternalOrder;
      if (event.container.id === 'pending') {
        this.updateOrderStatus(order, 'EN_ATTENTE');
      } else if (event.container.id === 'partial') {
        this.updateOrderStatus(order, 'PARTIELLEMENT_DISPONIBLE');
      } else if (event.container.id === 'available') {
        this.updateOrderStatus(order, 'DISPONIBLE');
      } else if (event.container.id === 'unavailable') {
        this.updateOrderStatus(order, 'NON_DISPONIBLE');
      }
    }
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  loadComments(orderId: number): void {
    this.loadingComments = true;
    this.api.get<any[]>(`comments?commentable_type=internal_order&commentable_id=${orderId}`).subscribe({
      next: res => {
        this.comments = res;
        this.loadingComments = false;
      },
      error: () => this.loadingComments = false
    });
  }

  addComment(orderId: number): void {
    if (!this.newComment.trim()) return;
    this.api.post<any>('comments', {
      commentable_type: 'internal_order',
      commentable_id: orderId,
      body: this.newComment
    }).subscribe(() => {
      this.newComment = '';
      this.loadComments(orderId);
    });
  }

  startEditComment(c: any): void {
    this.editingCommentId = c.id;
    this.editCommentText = c.body;
  }

  cancelEditComment(): void {
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  saveEditComment(commentId: number): void {
    if (!this.editCommentText.trim()) return;
    this.api.put<any>(`comments/${commentId}`, { body: this.editCommentText }).subscribe(() => {
      this.editingCommentId = null;
      this.editCommentText = '';
      if (this.selectedOrder) this.loadComments(this.selectedOrder.id);
    });
  }

  deleteComment(commentId: number, orderId: number): void {
    this.api.delete(`comments/${commentId}`).subscribe(() => {
      this.loadComments(orderId);
    });
  }

  // Trigger category load when going to step 2
  onGoToStep2(): void {
    this.selectedCategories = [];
    this.filteredCategories = [];
    this.loadFilteredCategoriesAndProducts();
    this.goStep(2);
  }
}
