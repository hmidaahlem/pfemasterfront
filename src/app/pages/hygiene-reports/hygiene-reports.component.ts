import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { HygieneReport, Product } from '../../core/models';
import { PageLoadingComponent } from '../../shared/page-loading/page-loading.component';
import { AppIconComponent } from '../../shared/icon/app-icon.component';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-hygiene-reports',
  standalone: true,
      templateUrl: './hygiene-reports.component.html',
  imports: [CommonModule, FormsModule, PageLoadingComponent, AppIconComponent]})
export class HygieneReportsComponent implements OnInit {
  reports: HygieneReport[] = [];
  foodProducts: Product[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editId = 0;
  form: any = { product_id: null, allergens_verified: false, expiration_verified: false, status: 'en_cours', remarks: '' };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.loadProducts();
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('hygiene-reports').subscribe({
      next: res => {
        this.reports = res.data || res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadProducts(): void {
    this.api.get<any>('products').subscribe({
      next: res => {
        const list = res.data || res;
        this.foodProducts = list.filter((p: Product) => p.approval_status === 'approved' && p.type !== 'matiere_premiere');
      }
    });
  }

  openModal(): void {
    this.form = { product_id: null, allergens_verified: false, expiration_verified: false, status: 'en_cours', remarks: '' };
    this.editing = false;
    this.showModal = true;
  }

  editReport(r: HygieneReport): void {
    this.form = { ...r };
    this.editId = r.id;
    this.editing = true;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  save(): void {
    if (!this.form.product_id) {
      Swal.fire('Erreur', 'Veuillez sélectionner un produit.', 'warning');
      return;
    }

    const req = this.editing
      ? this.api.put(`hygiene-reports/${this.editId}`, this.form)
      : this.api.post('hygiene-reports', this.form);

    req.subscribe({
      next: () => {
        Swal.fire({
          title: 'Succès !',
          text: this.editing ? 'Rapport mis à jour avec succès.' : 'Nouveau rapport d\'hygiène enregistré.',
          icon: 'success',
          confirmButtonColor: '#0D9488'
        });
        this.closeModal();
        this.load();
      },
      error: (err) => {
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Impossible d\'enregistrer le rapport.',
          icon: 'error',
          confirmButtonColor: '#EF4444'
        });
      }
    });
  }

  downloadReports(): void {
    this.api.getBlob('hygiene-reports/export').subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hygiene-reports-' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        Swal.fire({
          title: 'Erreur',
          text: 'Impossible de télécharger le rapport.',
          icon: 'error',
          confirmButtonColor: '#EF4444',
        });
      }
    });
  }

  deleteReport(id: number): void {
    Swal.fire({
      title: 'Supprimer ce rapport ?',
      text: 'Cette action effacera définitivement le rapport d’hygiène.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Oui, supprimer !',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.delete(`hygiene-reports/${id}`).subscribe({
          next: () => {
            Swal.fire({
              title: 'Supprimé !',
              text: 'Le rapport a été supprimé.',
              icon: 'success',
              confirmButtonColor: '#0D9488'
            });
            this.load();
          },
          error: (err) => {
            Swal.fire({
              title: 'Erreur',
              text: err.error?.message || 'Impossible d’effacer le rapport.',
              icon: 'error',
              confirmButtonColor: '#EF4444'
            });
          }
        });
      }
    });
  }
}
