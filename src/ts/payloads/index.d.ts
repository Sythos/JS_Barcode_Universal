/*!
 * Sythos Barcode Suite — payload convention declarations
 * SPDX-License-Identifier: MIT
 */

import type { BitMatrix } from '../core/bit-matrix.js';

export interface VCardPhone { number: string; type?: string; }
export interface VCardAddress { type?: string; street?: string; city?: string; state?: string; zip?: string; country?: string; }
export interface VCardFields {
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  phones?: (VCardPhone | string)[];
  emails?: string[];
  url?: string;
  address?: VCardAddress;
  note?: string;
}
export function buildVCard(fields: VCardFields): string;
export function encodeVCard(fields: VCardFields, options?: Record<string, unknown>): BitMatrix;
export function parseVCard(text: string): VCardFields;
export function decodeVCard(matrix: unknown): VCardFields;

export function vinCheckDigit(vin: string): string;
export function validateVIN(vin: string): boolean;
export function encodeVIN(vin: string, options?: { computeCheckDigit?: boolean }): BitMatrix;

export type SPARQCodeType =
  | 'url' | 'email' | 'phone' | 'sms' | 'geo' | 'wifi' | 'bizcard' | 'youtube' | 'googleplay' | 'icalendar';
export function buildSPARQCodePayload(type: SPARQCodeType, fields: Record<string, unknown>): string;
export function encodeSPARQCode(type: SPARQCodeType, fields: Record<string, unknown>, options?: Record<string, unknown>): BitMatrix;
export interface ParsedSPARQCode {
  type: SPARQCodeType;
  fields: Record<string, unknown>;
}
export function parseSPARQCodePayload(text: string): ParsedSPARQCode;
export function decodeSPARQCode(matrix: unknown): ParsedSPARQCode;

export interface SwissQRAddress {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode: string;
  city: string;
  country: string;
}
export interface SwissQRFields {
  iban: string;
  creditor: SwissQRAddress;
  debtor?: SwissQRAddress;
  amount?: number;
  currency?: 'CHF' | 'EUR';
  referenceType: 'QRR' | 'SCOR' | 'NON';
  reference?: string;
  unstructuredMessage?: string;
  billingInformation?: string;
  alternativeProcedures?: string[];
}
export function qrReferenceCheckDigit(digits: string): string;
export function validateIBAN(iban: string): boolean;
export function isQrIban(iban: string): boolean;
export function buildSwissQR(fields: SwissQRFields): string;
export function encodeSwissQR(fields: SwissQRFields, options?: Record<string, unknown>): BitMatrix;
export function parseSwissQR(text: string): SwissQRFields;
export function decodeSwissQR(matrix: unknown): SwissQRFields;

export interface SEPAQRFields {
  version?: '001' | '002';
  bic?: string;
  name: string;
  iban: string;
  amount?: number;
  purpose?: string;
  structuredReference?: string;
  unstructuredReference?: string;
  beneficiaryInfo?: string;
}
export function buildSEPAQR(fields: SEPAQRFields): string;
export function encodeSEPAQR(fields: SEPAQRFields, options?: Record<string, unknown>): BitMatrix;
export function parseSEPAQR(text: string): SEPAQRFields;
export function decodeSEPAQR(matrix: unknown): SEPAQRFields;

export interface AAMVAFields {
  iin: string;
  aamvaVersion?: string;
  jurisdictionVersion?: string;
  documentType?: 'DL' | 'ID';
  vehicleClass: string;
  restrictions: string;
  endorsements: string;
  expirationDate: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  issueDate: string;
  dateOfBirth: string;
  sex: '1' | '2' | '9';
  eyeColor: string;
  height: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  customerId: string;
  documentDiscriminator: string;
  country: 'USA' | 'CAN';
  familyNameTruncation?: 'T' | 'N' | 'U';
  firstNameTruncation?: 'T' | 'N' | 'U';
  middleNameTruncation?: 'T' | 'N' | 'U';
  suffix?: string;
}
export function buildAAMVA(fields: AAMVAFields): string;
export function encodeAAMVA(fields: AAMVAFields, options?: Record<string, unknown>): BitMatrix;
export function parseAAMVA(text: string): AAMVAFields;
export function decodeAAMVA(matrix: unknown): AAMVAFields;
