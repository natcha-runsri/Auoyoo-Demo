import { HttpInterceptorFn } from '@angular/common/http';
import { Type } from '@angular/core';

/**
 * จุดเชื่อมโหมดเดโม — build ปกติ (production/development/test) ใช้ไฟล์นี้: ไม่มีอะไรเลย
 * configuration "demo" ใน angular.json แทนไฟล์นี้ด้วย demo-mode.demo.ts (fileReplacements)
 * โค้ดข้อมูลจำลองทั้งหมดจึงไม่ถูกรวมเข้า bundle ของ production
 */
export const DEMO_INTERCEPTORS: HttpInterceptorFn[] = [];

/** แถบ "โหมดเดโม" ขอบล่างทุกหน้า — null = ไม่แสดง */
export const DEMO_BANNER: Type<unknown> | null = null;

/** ข้อความใน footer แทนข้อความลิขสิทธิ์ร้านค้าต้นทาง — null = ใช้ข้อความเดิม */
export const DEMO_FOOTER_NOTE: string | null = null;
