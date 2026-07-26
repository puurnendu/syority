import type { BlindType, BlindStatus } from '@prisma/client';

export interface ExtractedBlind {
  blind_number: string;
  blind_type: BlindType;
  pipeline_number: string | null;
  location: string | null;
  flange_size: string | null;
  rating: string | null;
  status: BlindStatus;
  notes?: string;
}

export const BLIND_EXTRACTION_PROMPT = (equipmentTag: string, equipmentType: string) => `
You are an expert STO Planning Engineer.
Extract all Isolation Blinds, Spades, Spacers, and Spectacle Blinds for ${equipmentType} (Tag: ${equipmentTag}) from the attached technical drawing.

IDENTIFICATION RULES:
1. Look for annotations like "BL", "SP", "SB", "BLIND", "SPADE", "SPACER", "SPECTACLE".
2. On P&IDs, look for the isolation symbol (a figure-8 or a thick line between flanges).
3. If no specific blind numbers are found, generate logical ones using the format: B-\${equipmentTag}-\${ID} (e.g., B-E-435-01).

EXTRACT THESE FIELDS for each blind found:
- blind_number: The unique identifier (e.g., B-101)
- blind_type: Must be one of: [spectacle, paddle, figure_8, blind_flange, blanking_disc]
- pipeline_number: The associated line number (if visible)
- location: Description (e.g., Inlet Nozzle, Vent, Drain)
- flange_size: e.g., 4", 8"
- rating: e.g., 150#, 300#

RETURN A JSON ARRAY OF OBJECTS ONLY.
Example:
[
  {
    "blind_number": "B-E435-01",
    "blind_type": "spectacle",
    "pipeline_number": "10-P-1001",
    "location": "Channel Inlet",
    "flange_size": "8\"",
    "rating": "300#"
  }
]
`;

export const BLIND_TEXT_PROMPT = (equipmentTag: string, equipmentType: string, text: string) => `
Analyze the following document text and extract all required isolation blinds for ${equipmentType} ${equipmentTag}.

TEXT DATA:
\${text}

EXTRACT BLINDS using the same JSON format as specified:
{
  "blind_number": string,
  "blind_type": "spectacle" | "paddle" | "figure_8" | "blind_flange" | "blanking_disc",
  "pipeline_number": string,
  "location": string,
  "flange_size": string,
  "rating": string
}
`;

export function getStandardBlindsForType(
  equipmentType: string,
  equipmentTag: string
): ExtractedBlind[] {
  const prefix = equipmentTag ? `B-\${equipmentTag.replace(/\\s+/g, '')}-` : 'B-';
  
  // Basic fallback for a typical vessel/exchanger
  return [
    {
      blind_number: `\${prefix}01`,
      blind_type: 'spectacle',
      pipeline_number: null,
      location: 'Main Inlet',
      flange_size: null,
      rating: null,
      status: 'pending'
    },
    {
      blind_number: `\${prefix}02`,
      blind_type: 'spectacle',
      pipeline_number: null,
      location: 'Main Outlet',
      flange_size: null,
      rating: null,
      status: 'pending'
    }
  ];
}
