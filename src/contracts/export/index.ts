/**
 * ⚠️ CONTRAT SSOT — Orchestrateur des Exports
 * * Ce fichier est l'unique point d'entrée pour les contrats de données.
 * Il mappe les versions physiques (v2, v1) vers des alias génériques
 * pour éviter que le reste de l'application ne dépende de numéros de version.
 */

// 1. Imports des versions spécifiques (Source de Vérité)
import { TicketV2Schema, type TicketV2 } from './ticket.v2';
import { EvidenceV2Schema, type EvidenceV2 } from './evidence.v2';
import { CSVExportV1Schema, type CSVExportV1 } from './csv.v1';

// 2. Export des alias génériques "Current" pour le reste de l'app
// Utilisation : import { Ticket, TicketSchema } from '@/contracts/export';
export { 
  TicketV2Schema as TicketSchema, 
  type TicketV2 as Ticket 
};

export { 
  EvidenceV2Schema as EvidenceSchema, 
  type EvidenceV2 as Evidence 
};

export {
  CSVExportV1Schema as CSVSchema,
  type CSVExportV1 as CSV
};

// 3. Ré-export des utilitaires métier (si besoin d'accès direct)
// On garde l'accès aux fonctions de tri et de génération d'IDs
export * from './ticket.v2';
export * from './evidence.v2';
export * from './csv.v1';