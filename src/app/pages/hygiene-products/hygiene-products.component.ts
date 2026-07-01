import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { PageLoadingComponent } from '../../shared/page-loading/page-loading.component';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';
import { AppIconComponent } from '../../shared/icon/app-icon.component';

@Component({
  selector: 'app-hygiene-products',
  standalone: true,
    templateUrl: './hygiene-products.component.html',
  imports: [CommonModule, FormsModule, PageLoadingComponent, AppIconComponent]})


export class HygieneProductsComponent implements OnInit {
  products: any[] = [];
  loading = true;
  editingId: number | null = null;
  editAllergensText = '';
  editExpiration = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('products', { no_paginate: true, type: 'food' }).subscribe({
      next: res => {
        this.products = res.data || res;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  getAllergens(p: any): string[] {
    if (!p.allergens) return [];
    if (Array.isArray(p.allergens)) return p.allergens;
    try {
      return JSON.parse(p.allergens);
    } catch {
      return [];
    }
  }

  startEdit(p: any): void {
    this.editingId = p.id;
    this.editAllergensText = this.getAllergens(p).join(', ');
    this.editExpiration = p.expiration_date || '';
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editAllergensText = '';
    this.editExpiration = '';
  }

  saveHygiene(p: any): void {
    const payload: any = {};
    const allergens = this.editAllergensText
      .split(',')
      .map((a: string) => a.trim())
      .filter((a: string) => a.length > 0);

    payload.allergens = allergens;
    payload.expiration_date = this.editExpiration || null;

    this.api.put(`products/${p.id}/hygiene`, payload).subscribe({
      next: () => {
        p.allergens = allergens;
        p.expiration_date = this.editExpiration || null;
        this.cancelEdit();
        Swal.fire({
          title: 'Mis à jour',
          text: 'Allergènes et date de péremption mis à jour.',
          icon: 'success',
          confirmButtonColor: '#0D9488',
          timer: 1500,
          showConfirmButton: false,
        });
      },
      error: (err: any) => {
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Impossible de mettre à jour.',
          icon: 'error',
          confirmButtonColor: '#EF4444',
        });
      }
    });
  }

  isExpired(date: string | null): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  isExpiringSoon(date: string | null): boolean {
    if (!date) return false;
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    return new Date(date) <= in7Days && new Date(date) >= new Date();
  }

  getImageUrl(path: string): string {
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}/storage/${path}`;
  }
}
