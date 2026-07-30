# M7.6B — Branding & Layout Architecture

## Overview

Branding and Layouts are now separate concepts:

- **Layout** = page structure (margins, page size, orientation, header/footer HTML)
- **Branding Profile** = visual identity (logo, colors, fonts, company info, signatures, legal)

## Resolution Chain

```
Layout → Branding Profile → Organization Settings → Platform Defaults
```

Each level overrides only the fields it explicitly sets. Null fields pass through to the next level.

### Priority (highest → lowest)

| Priority | Source | What it provides |
|----------|--------|-----------------|
| 1 | **Layout** | Page structure, header/footer HTML, logo override |
| 2 | **Branding Profile** | Full visual identity, company info, signatures, legal |
| 3 | **Organization** | Logo, primary color, org name |
| 4 | **Platform Defaults** | Fallback values for all fields |

## Branding Profile Fields

| Field | Default | Description |
|-------|---------|-------------|
| `logo_url` | — | Company logo URL |
| `logo_width_px` | 180 | Logo width in pixels |
| `logo_height_px` | 50 | Logo height in pixels |
| `header_html` | — | Custom header with `{{orgName}}`, `{{reportTitle}}` |
| `footer_html` | — | Custom footer with `{{page}}`, `{{total_pages}}`, `{{date}}` |
| `company_name` | — | Company name printed on reports |
| `company_address` | — | Company address |
| `company_phone` | — | Contact phone |
| `company_email` | — | Contact email |
| `company_website` | — | Company website |
| `primary_color` | `#0D2137` | Primary brand color |
| `secondary_color` | `#1E3A5F` | Secondary color |
| `accent_color` | `#E8701A` | Accent color |
| `background_color` | `#FFFFFF` | Report background |
| `text_color` | `#1F2937` | Main text color |
| `font_family` | `Inter, Arial, sans-serif` | Body font |
| `heading_font` | `Inter, Arial, sans-serif` | Heading font |
| `font_size_base` | 12 | Base font size (px) |
| `signature_block` | false | Show signature block |
| `signature_labels` | `[]` | Signature line labels |
| `disclaimer_text` | — | Legal disclaimer |
| `confidentiality` | `CONFIDENTIAL` | Confidentiality marking |

## One Default Per Organization

Each organization can have one default branding profile. When generating a report without an explicit profile, the engine automatically uses the org's default. Setting a new default clears the previous one.

## API Usage

```bash
# List profiles
GET /api/report-builder/branding

# Create profile
POST /api/report-builder/branding
{
  "name": "Corporate Standard",
  "logo_url": "https://...",
  "primary_color": "#003366",
  "is_default": true
}

# Update
PUT /api/report-builder/branding/{id}

# Delete
DELETE /api/report-builder/branding/{id}
```
