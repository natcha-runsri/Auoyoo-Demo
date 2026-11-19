import { HttpInterceptorFn } from '@angular/common/http';
import { Type } from '@angular/core';
import { demoBackendInterceptor } from './demo-backend';
import { DemoBannerComponent } from './demo-banner.component';

/**
 * โหมดเดโม (configuration "demo") — แทนที่ demo-mode.ts ผ่าน fileReplacements ใน angular.json
 * ต้อง export ชื่อและชนิดเดียวกับ demo-mode.ts
 */
export const DEMO_INTERCEPTORS: HttpInterceptorFn[] = [demoBackendInterceptor];

export const DEMO_BANNER: Type<unknown> | null = DemoBannerComponent;

export const DEMO_FOOTER_NOTE: string | null =
  'ข้อมูลสินค้า แบรนด์ ราคา ร้านค้า และรูปทั้งหมดในเดโมนี้แต่งขึ้นเองเพื่อสาธิต ไม่ใช่ข้อมูลจริงและไม่ได้มาจากร้านค้าใด';
