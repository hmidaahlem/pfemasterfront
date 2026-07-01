import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Menu, Product } from '../../core/models';
import { PageLoadingComponent } from '../../shared/page-loading/page-loading.component';
import Swal from 'sweetalert2';

interface DayMenu {
  breakfast: number;
  snack: number;
  lunch: number;
  dinner: number;
}

interface WeekPlan {
  [key: string]: DayMenu;
  monday: DayMenu;
  tuesday: DayMenu;
  wednesday: DayMenu;
  thursday: DayMenu;
  friday: DayMenu;
  saturday: DayMenu;
  sunday: DayMenu;
}

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoadingComponent],
    templateUrl: './menus.component.html',
  styleUrl: './menus.component.scss'

})
export class MenusComponent implements OnInit {
  menus: Menu[] = [];
  allProducts: Product[] = [];
  foodProducts: Product[] = [];

  loading = true;
  showModal = false;
  showDetailModal = false;
  showCloneModal = false;
  selectedMenu: Menu | null = null;
  editing = false;
  editId = 0;
  form: any = { name: '', start_date: '', end_date: '', staff_count: 50 };
  cloneForm: any = { source_menu_id: 0, target_week_start: '', target_week_end: '', staff_count: null };
  cloning = false;

  activeTab = 'monday';
  daysList = [
    { key: 'monday', label: 'Lundi' },
    { key: 'tuesday', label: 'Mardi' },
    { key: 'wednesday', label: 'Mercredi' },
    { key: 'thursday', label: 'Jeudi' },
    { key: 'friday', label: 'Vendredi' },
    { key: 'saturday', label: 'Samedi' },
    { key: 'sunday', label: 'Dimanche' }
  ];

  weekPlan: WeekPlan = this.createEmptyWeekPlan();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.loadAllProducts();
  }

  createEmptyWeekPlan(): WeekPlan {
    return {
      monday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 },
      tuesday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 },
      wednesday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 },
      thursday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 },
      friday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 },
      saturday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 },
      sunday: { breakfast: 0, snack: 0, lunch: 0, dinner: 0 }
    };
  }

  getDayLabel(key: string): string {
    const found = this.daysList.find(d => d.key === key);
    return found ? found.label : key;
  }

  selectMenu(menu: Menu): void {
    this.selectedMenu = menu;
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('menus').subscribe({
      next: res => {
        this.menus = res.data || res;
        this.loading = false;

        // Auto-select first menu
        if (this.menus.length > 0) {
          if (this.editId) {
            const updated = this.menus.find(m => m.id === this.editId);
            if (updated) this.selectedMenu = updated;
          } else if (this.selectedMenu) {
            const current = this.menus.find(m => m.id === this.selectedMenu!.id);
            this.selectedMenu = current || this.menus[0];
          } else {
            this.selectedMenu = this.menus[0];
          }
        } else {
          this.selectedMenu = null;
        }
      },
      error: () => { this.loading = false; },
      complete: () => { this.loading = false; }
    });
  }

  loadAllProducts(): void {
    this.api.get<any>('products', { no_paginate: true, type: 'plat', is_active: true }).subscribe(res => {
      this.allProducts = res.data || res;
      this.foodProducts = this.allProducts.filter(p => p.approval_status === 'approved');
    });
  }

  getCourseCount(menu: Menu, courseType: 'lunch' | 'lunch' | 'lunch' | 'lunch'): number {
    return (menu.items || []).filter(item => item.meal_type === courseType).length;
  }

  getDishName(menu: Menu, dayKey: string, mealType: string): string {
    if (!menu.items) return '-';
    const found = menu.items.find((i: any) => i.day_of_week === dayKey && i.meal_type === mealType);
    return found?.product?.name || '-';
  }

  openModal(): void {
    this.form = { name: '', start_date: '', end_date: '', staff_count: 50 };
    this.weekPlan = this.createEmptyWeekPlan();
    this.editing = false;
    this.activeTab = 'monday';
    this.showModal = true;
  }

  openCloneModal(): void {
    this.cloneForm = { source_menu_id: 0, target_week_start: '', target_week_end: '', staff_count: null };
    this.showCloneModal = true;
  }

  closeCloneModal(): void {
    this.showCloneModal = false;
    this.cloning = false;
  }

  cloneMenu(): void {
    if (!this.cloneForm.source_menu_id || !this.cloneForm.target_week_start || !this.cloneForm.target_week_end) {
      Swal.fire({
        title: 'Formulaire incomplet',
        text: 'Veuillez sélectionner un menu source et une semaine cible.',
        icon: 'warning',
        confirmButtonColor: '#0D9488'
      });
      return;
    }

    this.cloning = true;
    const payload: any = {
      target_week_start: this.cloneForm.target_week_start,
      target_week_end: this.cloneForm.target_week_end,
    };
    if (this.cloneForm.staff_count) {
      payload.staff_count = this.cloneForm.staff_count;
    }

    this.api.post(`menus/${this.cloneForm.source_menu_id}/clone`, payload).subscribe({
      next: (res: any) => {
        this.cloning = false;
        this.closeCloneModal();
        if (res.valid) {
          Swal.fire({
            title: 'Menu cloné avec succès !',
            html: `
              <p style="color: #15803D; font-weight: 600;">Tous les ingrédients sont en stock suffisant.</p>
              <p style="font-size:12px; color: #475569; margin-top: 8px;">Le nouveau menu est en statut BROUILLON, prêt à être modifié ou soumis.</p>
            `,
            icon: 'success',
            confirmButtonColor: '#0D9488'
          });
        } else {
          const items = res.insufficient_items || [];
          const details = items.map((i: any) =>
            `<div style="padding:6px 0; border-bottom:1px solid #FEE2E2;">
              <strong>${i.product}</strong><br>
              <span style="color:#991B1B;">Requis: ${i.required} ${i.unit} — Disponible: ${i.available} ${i.unit}</span>
            </div>`
          ).join('');

          Swal.fire({
            title: 'Menu cloné — Attention',
            html: `
              <p style="margin-bottom: 12px;">Le menu a été cloné mais certains ingrédients sont insuffisants :</p>
              <div style="text-align:left; background:#FEF2F2; border:1px solid #FECACA; padding:12px; border-radius:8px; max-height:200px; overflow-y:auto;">
                ${details || '<p style="color:#991B1B;">Impossible de vérifier les stocks.</p>'}
              </div>
              <p style="margin-top:12px; font-size:12px; color:#475569;">
                Vous pouvez modifier le menu avant de le soumettre.
              </p>
            `,
            icon: 'warning',
            confirmButtonColor: '#F59E0B'
          });
        }
        this.load();
      },
      error: (err: any) => {
        this.cloning = false;
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Impossible de cloner le menu.',
          icon: 'error',
          confirmButtonColor: '#EF4444'
        });
      }
    });
  }

  editMenu(m: Menu): void {
    this.form = {
      name: m.name,
      start_date: m.start_date,
      end_date:   m.end_date,
      staff_count: m.staff_count || 50
    };
    this.editId = m.id;
    this.editing = true;
    this.activeTab = 'monday';

    this.weekPlan = this.createEmptyWeekPlan();
    if (m.items) {
      m.items.forEach((item: any) => {
        const day = item.day_of_week as keyof WeekPlan;
        const type = item.meal_type as keyof DayMenu;
        if (this.weekPlan[day] && type in this.weekPlan[day]) {
          this.weekPlan[day][type] = item.product_id;
        }
      });
    }

    this.showModal = true;
  }

  viewMenu(m: Menu): void {
    this.selectedMenu = m;
    this.showDetailModal = true;
  }

  closeModal(): void { this.showModal = false; }
  closeDetailModal(): void { this.showDetailModal = false; this.selectedMenu = null; }

  getFlatItems(): any[] {
    const items: any[] = [];
    const days: (keyof WeekPlan)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const courses: (keyof DayMenu)[] = ['breakfast', 'snack', 'lunch', 'dinner'];

    for (const d of days) {
      for (const c of courses) {
        const val = Number(this.weekPlan[d][c]);
        if (val > 0) {
          items.push({
            product_id: val,
            day_of_week: d,
            meal_type: c
          });
        }
      }
    }
    return items;
  }

  save(): void {
    if (!this.form.name || !this.form.start_date || !this.form.end_date || !this.form.staff_count) {
      Swal.fire({
        title: 'Formulaire incomplet',
        text: 'Veuillez renseigner le nom, les dates et le nombre de personnes.',
        icon: 'warning',
        confirmButtonColor: '#0D9488'
      });
      return;
    }

    const flatItems = this.getFlatItems();
    if (flatItems.length === 0) {
      Swal.fire({
        title: 'Planification vide',
        text: 'Veuillez choisir au moins un plat dans votre menu.',
        icon: 'warning',
        confirmButtonColor: '#0D9488'
      });
      return;
    }

    const payload = {
      name: this.form.name,
      start_date: this.form.start_date,
      end_date:   this.form.end_date,
      staff_count: this.form.staff_count,
      items: flatItems
    };

    const req = this.editing
      ? this.api.put(`menus/${this.editId}`, payload)
      : this.api.post('menus', payload);

    req.subscribe({
      next: (res: any) => {
        const need = res?.purchase_need;
        const restockMsg = need?.items_requiring_restock > 0
          ? `<br><span style="font-size:12px;color:#B45309;">${need.items_requiring_restock} ingrédients nécessitent un réapprovisionnement — liste envoyée au Chef Magasin.</span>`
          : '';
        Swal.fire({
          title: 'Brouillon sauvegardé !',
          html: (this.editing ? 'Le menu a été mis à jour.' : 'Le menu a été créé. Vous pouvez maintenant le soumettre pour validation.') + restockMsg,
          icon: 'success',
          confirmButtonColor: '#0D9488'
        });
        this.closeModal();
        this.load();
      },
      error: (err: any) => {
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Une erreur est survenue.',
          icon: 'error',
          confirmButtonColor: '#EF4444'
        });
      }
    });
  }

  submitMenu(menu: Menu): void {
    Swal.fire({
      title: 'Soumettre le menu ?',
      text: `Le menu "${menu.name}" sera vérifié contre le stock disponible pour ${menu.staff_count || 50} personnes.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0D9488',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Oui, soumettre',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.post(`menus/${menu.id}/submit`, {}).subscribe({
          next: (res: any) => {
            const updatedMenu = res.menu as Menu;
            const need = res?.purchase_need;
            const restockMsg = need?.items_requiring_restock > 0
              ? `<p style="margin-top:8px; font-size:12px; color:#B45309;">${need.items_requiring_restock} ingrédients nécessitent un réapprovisionnement — liste envoyée au Chef Magasin.</p>`
              : '';
            if (updatedMenu.status === 'VALIDE') {
              Swal.fire({
                title: 'Menu Validé !',
                html: `<p style="color: #15803D; font-weight: 600;">Tous les ingrédients sont en stock suffisant. Le menu a été validé et les stocks déduits (FIFO).</p>${restockMsg}`,
                icon: 'success',
                confirmButtonColor: '#0D9488'
              });
            } else {
              Swal.fire({
                title: 'Menu traité',
                html: `<p style="color: #475569;">Le menu a été soumis.</p>${restockMsg}`,
                icon: 'info',
                confirmButtonColor: '#0D9488'
              });
            }
            this.load();
          },
          error: (err: any) => {
            const errorData = err.error;
            if (errorData?.menu?.status === 'REFUSE') {
              const items = errorData.insufficient_items || [];
              const details = items.map((i: any) =>
                `<div style="padding:6px 0; border-bottom:1px solid #FEE2E2;">
                  <strong>${i.product}</strong><br>
                  <span style="color:#991B1B;">Requis: ${i.required} ${i.unit} — Disponible: ${i.available} ${i.unit}</span>
                </div>`
              ).join('');

              Swal.fire({
                title: 'Menu Refusé — Stock Insuffisant',
                html: `
                  <p style="color: #991B1B; margin-bottom: 12px;">Les ingrédients suivants sont insuffisants :</p>
                  <div style="text-align:left; background:#FEF2F2; border:1px solid #FECACA; padding:12px; border-radius:8px; max-height:200px; overflow-y:auto;">
                    ${details}
                  </div>
                  <p style="margin-top:12px; font-size:12px; color:#475569;">
                    Une notification a été envoyée au Chef Magasin et au Responsable F&B.
                  </p>
                  <p style="margin-top:4px; font-size:12px; color:#B45309;">
                    ${errorData?.purchase_need?.items_requiring_restock || 0} ingrédients nécessitent un réapprovisionnement.
                  </p>
                `,
                icon: 'error',
                confirmButtonColor: '#EF4444',
                confirmButtonText: 'Compris'
              });
            } else {
              Swal.fire({
                title: 'Erreur',
                text: errorData?.message || 'Impossible de soumettre le menu.',
                icon: 'error',
                confirmButtonColor: '#EF4444'
              });
            }
            this.load();
          }
        });
      }
    });
  }

  deleteMenu(id: number): void {
    Swal.fire({
      title: 'Supprimer ce menu ?',
      text: 'Cette action supprimera définitivement le menu et ses plats.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#C0483A',
      cancelButtonColor: '#4b5563',
      confirmButtonText: 'Oui, supprimer !',
      cancelButtonText: 'Annuler'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.api.delete(`menus/${id}`).subscribe({
          next: () => {
            Swal.fire({
              title: 'Supprimé !',
              text: 'Le menu a été supprimé.',
              icon: 'success',
              confirmButtonColor: '#0D9488'
            });
            if (this.selectedMenu?.id === id) {
              this.selectedMenu = null;
            }
            this.load();
          },
          error: (err: any) => {
            Swal.fire({
              title: 'Erreur',
              text: err.error?.message || 'Impossible de supprimer ce menu.',
              icon: 'error',
              confirmButtonColor: '#0D9488'
            });
          }
        });
      }
    });
  }
}
