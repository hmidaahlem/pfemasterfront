import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, Category } from '../../core/models';
import { PageLoadingComponent } from '../../shared/page-loading/page-loading.component';
import { AppIconComponent } from '../../shared/icon/app-icon.component';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent, AppIconComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'


})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  categories: Category[] = [];
  filteredProducts: Product[] = [];

  filterType = '';
  filterApprovalStatus = '';
  loading = true;
  validationMode = false;


  showChatbot = false;
  chatbotProduct: Product | null = null;
  chatbotMessages: { sender: 'user' | 'bot'; text: string }[] = [];
  chatbotInput = '';
  chatbotLoading = false;

  openChatbot(p: Product): void {
    this.chatbotProduct = p;
    this.chatbotMessages = [
      { sender: 'bot', text: `Bonjour ! Je suis l'assistant nutritionnel d'AeroServe. Posez-moi vos questions concernant la composition, les ingrédients et les allergènes pour le produit **${p.name}**.` }
    ];
    this.showChatbot = true;
  }

  closeChatbot(): void {
    this.showChatbot = false;
    this.chatbotProduct = null;
  }

  sendChatbotMessage(): void {
    if (!this.chatbotInput.trim() || !this.chatbotProduct || this.chatbotLoading) return;

    const userMsg = this.chatbotInput.trim();
    this.chatbotMessages.push({ sender: 'user', text: userMsg });
    this.chatbotInput = '';
    this.chatbotLoading = true;

    this.api.post<any>('chatbot/ask', {
      product_id: this.chatbotProduct.id,
      message: userMsg
    }).subscribe({
      next: (res) => {
        this.chatbotMessages.push({ sender: 'bot', text: res.response });
        this.chatbotLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.chatbotMessages.push({ sender: 'bot', text: "Désolé, je rencontre des difficultés pour me connecter au service d'intelligence artificielle pour le moment." });
        this.chatbotLoading = false;
      }
    });
  }

  askQuickQuestion(question: string): void {
    this.chatbotInput = question;
    this.sendChatbotMessage();
  }

  showModal = false;
  editing = false;
  editId: number | null = null;

  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  selectedProductApprovalStatus: 'pending' | 'approved' | 'rejected' = 'pending';

  recipeIngredients: { product_id: number; quantity: number; unit: string }[] = [];

  get userRole(): string {
    return this.auth.getUserRole() || '';
  }

  get isChefCuisine(): boolean {
    return this.userRole === 'CHEF_CUISINE';
  }

  get isChefMagasin(): boolean {
    return this.userRole === 'CHEF_MAGASIN';
  }

  get isResponsableAchat(): boolean {
    return this.userRole === 'RESPONSABLE_ACHAT';
  }

  get isRestrictedRole(): boolean {
    return this.isChefCuisine || this.isChefMagasin;
  }

  form: any = {
    name: '',
    type: 'commercial',
    category_id: '',
    price: 0,
    description: '',
    allergens_text: '',
    expiration_date: '',
    usage_status: 'IN_USE',
    quantity_per_batch: 1,
    unit: 'piece'
  };

  constructor(private api: ApiService, private auth: AuthService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.validationMode = this.route.snapshot.data['validationMode'] === true;

    // Role-based default type filter
    if (this.userRole === 'CHEF_CUISINE') {
      this.filterType = '';
    } else if (this.userRole === 'CHEF_MAGASIN') {
      this.filterType = 'reserve';
    }

    // Default filter pending for validationMode
    if (this.validationMode) {
      this.filterApprovalStatus = 'pending';
    }
    this.load();
    this.loadCategories();
  }

  // ================= PRODUCTS =================
  load(): void {
    this.loading = true;
    const params: any = { no_paginate: true };
    if (this.userRole === 'CHEF_CUISINE') {
      params.all_types = true;
    }
    // CHEF_CUISINE gets food/plat only from backend by default
    // all_types=true is set when CHEF_CUISINE needs ingredients for recipe builder and validation
    this.api.get<any>('products', params).subscribe({
      next: res => {
        this.products = res.data || res;
        this.applyFilter();
      },
      error: () => { this.loading = false; },
      complete: () => { this.loading = false; }
    });
  }

  // ================= CATEGORIES =================
  loadCategories(): void {
    this.api.get<any>('categories').subscribe(res => {
      this.categories = res.data || res;
    });
  }

  get formCategories(): Category[] {
    const selectedType = this.form?.type;
    let base = this.categories;

    if (this.isChefCuisine) {
      base = base.filter(c => c.type === 'food' || c.type === 'plat');
    } else if (this.isChefMagasin) {
      base = base.filter(c => c.type === 'commercial' || c.type === 'matiere_premiere');
    }

    // Filter by selected product type
    if (selectedType) {
      base = base.filter(c => c.type === selectedType);
    }

    return base;
  }

  get availableIngredients(): Product[] {
    return this.products.filter(p =>
      p.type === 'matiere_premiere' &&
      p.approval_status === 'approved'
    );
  }

  getImageUrl(path: string): string {
    const apiHost = environment.apiUrl.replace('/api', '');
    return `${apiHost}/storage/${path}`;
  }

  // ================= FILTER =================
  applyFilter(): void {
    let filtered = [...this.products];
    if (this.filterType === 'reserve') {
      filtered = filtered.filter(p => p.type === 'commercial' || p.type === 'matiere_premiere');
    } else if (this.filterType) {
      filtered = filtered.filter(p => p.type === this.filterType);
    } else if (this.userRole === 'CHEF_CUISINE') {
      // If no specific type filter is chosen, CHEF_CUISINE should only see food and plat products in the table list
      filtered = filtered.filter(p => p.type === 'food' || p.type === 'plat');
    }
    if (this.filterApprovalStatus) {
      filtered = filtered.filter(p => p.approval_status === this.filterApprovalStatus);
    }
    this.filteredProducts = filtered;
  }

  // ================= MODAL =================
  openModal(): void {
    this.resetForm();
    this.editing = false;
    this.showModal = true;
  }

  editProduct(p: Product): void {
    this.loading = true;
    this.api.get<any>(`products/${p.id}`).subscribe({
      next: res => {
        const fullProduct = res.data || res;
        this.form = {
          name: fullProduct.name,
          type: fullProduct.type,
          category_id: fullProduct.category_id,
          price: fullProduct.price,
          description: fullProduct.description || '',
          allergens_text: fullProduct.allergens?.join(', ') || '',
          expiration_date: fullProduct.expiration_date || '',
          usage_status: fullProduct.usage_status || 'IN_USE',
          quantity_per_batch: fullProduct.quantity_per_batch || 1,
          unit: fullProduct.stock?.unit || 'piece',
          min_threshold: fullProduct.stock?.min_threshold || 0,
          is_active: fullProduct.is_active !== undefined ? fullProduct.is_active : true
        };

        this.selectedProductApprovalStatus = fullProduct.approval_status;
        this.imagePreview = fullProduct.image ? this.getImageUrl(fullProduct.image) : null;
        this.selectedImageFile = null;

        this.recipeIngredients = (fullProduct.ingredients || []).map((ing: any) => ({
          product_id: ing.id,
          quantity: ing.pivot?.quantity || 1,
          unit: ing.pivot?.unit || 'piece'
        }));

        this.editId = fullProduct.id;
        this.editing = true;
        this.showModal = true;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Impossible de charger les détails du produit.',
          icon: 'error',
          confirmButtonColor: '#EF4444'
        });
      }
    });
  }

  closeModal(): void {
    this.showModal = false;
  }

  resetForm(): void {
    this.form = {
      name: '',
      type: this.isChefCuisine ? (this.form.type || 'food') : 'commercial',
      category_id: '',
      price: 0,
      description: '',
      allergens_text: '',
      expiration_date: '',
      usage_status: 'IN_USE',
      quantity_per_batch: 1,
      unit: 'piece',
      min_threshold: 0,
      is_active: true
    };
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.recipeIngredients = [];
    this.selectedProductApprovalStatus = 'pending';
    this.editId = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  isLockedField(fieldName: string): boolean {
    if (!this.editing) return false;
    if (this.isChefCuisine) return false;
    if (this.isResponsableAchat) {
      if (fieldName === 'price' || fieldName === 'category_id' || fieldName === 'description' || fieldName === 'image') {
        return false;
      }
    }
    if (this.selectedProductApprovalStatus === 'approved') {
      const editableFields = ['description', 'usage_status', 'image', 'allergens'];
      return !editableFields.includes(fieldName);
    }
    return false;
  }

  addRecipeIngredient(): void {
    this.recipeIngredients.push({ product_id: 0, quantity: 1, unit: 'piece' });
  }

  removeRecipeIngredient(index: number): void {
    this.recipeIngredients.splice(index, 1);
  }

  save(): void {
    if (!this.form.name || !this.form.type || ((this.form.type !== 'food' && this.form.type !== 'plat') && !this.form.category_id)) {
      Swal.fire({
        title: 'Formulaire incomplet',
        text: 'Veuillez remplir tous les champs obligatoires.',
        icon: 'warning',
        confirmButtonColor: '#0D9488'
      });
      return;
    }

    if ((this.form.type === 'food' || this.form.type === 'plat') && this.recipeIngredients.length === 0) {
      Swal.fire({
        title: 'Recette manquante',
        text: 'Un produit Food doit contenir au moins un ingrédient dans sa recette.',
        icon: 'warning',
        confirmButtonColor: '#0D9488'
      });
      return;
    }

    if ((this.form.type === 'food' || this.form.type === 'plat') && this.recipeIngredients.some(ing => ing.product_id == 0)) {
      Swal.fire({
        title: 'Recette incomplète',
        text: 'Veuillez sélectionner un produit valide pour chaque ingrédient.',
        icon: 'warning',
        confirmButtonColor: '#0D9488'
      });
      return;
    }

    const formData = new FormData();
    formData.append('name', this.form.name);
    formData.append('type', this.form.type);
    formData.append('category_id', String(this.form.category_id));
    formData.append('description', this.form.description || '');
    formData.append('unit', this.form.unit || 'piece');

    if (this.form.type === 'food' || this.form.type === 'plat') {
      formData.append('quantity_per_batch', String(this.form.quantity_per_batch || 1));
    }

    if (this.form.type !== 'plat') {
      formData.append('min_threshold', String(this.form.min_threshold || 0));
    }
    formData.append('is_active', this.form.is_active ? '1' : '0');

    if (!this.isRestrictedRole) {
      formData.append('price', String(this.form.price || 0));
      if (!this.isResponsableAchat) {
        formData.append('expiration_date', this.form.expiration_date || '');
        if (this.form.allergens_text) {
          const allergens = this.form.allergens_text.split(',').map((a: string) => a.trim()).filter(Boolean);
          allergens.forEach((a: string) => formData.append('allergens[]', a));
        }
      }
    }

    if (this.selectedImageFile) {
      formData.append('image', this.selectedImageFile);
    }

    // In approved mode, the restricted roles might change usage_status
    if (this.editing && this.selectedProductApprovalStatus === 'approved') {
      formData.append('usage_status', this.form.usage_status || 'IN_USE');
    }

    if (this.form.type === 'food' || this.form.type === 'plat') {
      this.recipeIngredients.forEach((ing, index) => {
        formData.append(`ingredients[${index}][product_id]`, String(ing.product_id));
        formData.append(`ingredients[${index}][quantity]`, String(ing.quantity));
        formData.append(`ingredients[${index}][unit]`, ing.unit || 'piece');
      });
    }

    const req = this.editing && this.editId
      ? this.api.put(`products/${this.editId}`, formData)
      : this.api.post('products', formData);

    req.subscribe({
      next: () => {
        Swal.fire({
          title: 'Succès !',
          text: this.editing ? 'Le produit a été modifié.' : 'Le produit a été créé.',
          icon: 'success',
          confirmButtonColor: '#0D9488'
        });
        this.closeModal();
        this.load();
      },
      error: (err) => {
        console.error(err);
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Une erreur est survenue lors de la sauvegarde.',
          icon: 'error',
          confirmButtonColor: '#EF4444'
        });
      }
    });
  }

  // ================= APPROVAL STATUS =================
  updateApprovalStatus(product: Product, status: 'approved' | 'rejected'): void {
    if (status === 'approved') {
      Swal.fire({
        title: 'Approuver le produit ?',
        text: `Voulez-vous approuver le produit "${product.name}" ? Veuillez saisir le prix d'achat (TND) :`,
        input: 'number',
        inputAttributes: {
          min: '0',
          step: '0.01'
        },
        inputValue: String(product.price || 0),
        showCancelButton: true,
        confirmButtonColor: '#0D9488',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Approuver',
        cancelButtonText: 'Annuler',
        inputValidator: (value) => {
          if (value === null || value === undefined || value.trim() === '' || isNaN(Number(value)) || Number(value) < 0) {
            return 'Veuillez saisir un prix valide  !';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          const priceVal = Number(result.value);
          this.api.put(`products/${product.id}/approve`, { approval_status: status, price: priceVal }).subscribe({
            next: () => {
              Swal.fire({
                title: 'Succès !',
                text: 'Le produit a été approuvé avec succès.',
                icon: 'success',
                confirmButtonColor: '#0D9488'
              });
              this.load();
            },
            error: (err) => {
              Swal.fire({
                title: 'Erreur',
                text: err.error?.message || 'Une erreur est survenue lors de la validation.',
                icon: 'error',
                confirmButtonColor: '#EF4444'
              });
            }
          });
        }
      });
    } else {
      Swal.fire({
        title: 'Rejeter le produit ?',
        text: `Voulez-vous rejeter le produit "${product.name}" ?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Oui, rejeter',
        cancelButtonText: 'Annuler'
      }).then((result) => {
        if (result.isConfirmed) {
          this.api.put(`products/${product.id}/approve`, { approval_status: status }).subscribe({
            next: () => {
              Swal.fire({
                title: 'Succès !',
                text: 'Le produit a été rejeté.',
                icon: 'success',
                confirmButtonColor: '#0D9488'
              });
              this.load();
            },
            error: (err) => {
              Swal.fire({
                title: 'Erreur',
                text: err.error?.message || 'Une erreur est survenue lors de la validation.',
                icon: 'error',
                confirmButtonColor: '#EF4444'
              });
            }
          });
        }
      });
    }
  }

  // ================= DELETE =================
  deleteProduct(id: number): void {
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible !',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Oui, supprimer !',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.delete(`products/${id}`).subscribe({
          next: () => {
            Swal.fire({
              title: 'Supprimé !',
              text: 'Le produit a été supprimé.',
              icon: 'success',
              confirmButtonColor: '#0D9488'
            });
            this.load();
          },
          error: (err) => {
            Swal.fire({
              title: 'Erreur',
              text: err.error?.message || 'Erreur lors de la suppression.',
              icon: 'error',
              confirmButtonColor: '#EF4444'
            });
          }
        });
      }
    });
  }
}
