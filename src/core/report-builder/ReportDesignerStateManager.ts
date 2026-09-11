/**
 * M14-R5 — Report Designer State Manager
 *
 * Pure TypeScript client-side state engine for the visual Report Designer.
 * Reuses established state manager paradigms (undo/redo, canvas commands,
 * typed immutable snapshots).
 *
 * ZERO global mutable state. ZERO database queries. ZERO business metric recalculations.
 */

export interface ComponentPlacement {
  row: number;
  col: number;
  span: number;
}

export interface PlacedReportComponent {
  id: string;
  type: string; // matches ReportComponentCatalog.type
  position: ComponentPlacement;
  dimensions?: {
    heightPx?: number;
    widthPercent?: number;
  };
  configuration: Record<string, any>;
  isHidden?: boolean;
}

export interface ReportDesignerSection {
  id: string;
  title: string;
  collapsible?: boolean;
  columns: number;
  components: PlacedReportComponent[];
}

export interface ReportLayoutModel {
  pageSettings: {
    size: 'A4' | 'Letter' | 'A3';
    orientation: 'portrait' | 'landscape';
    margins: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
  header: {
    show: boolean;
    logoUrl?: string;
    companyName?: string;
    titleTemplate?: string;
  };
  footer: {
    show: boolean;
    showPageNumbers: boolean;
    disclaimerText?: string;
    confidentiality?: string;
  };
  sections: ReportDesignerSection[];
  presentationProfile: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    fontSizeBase: number;
  };
}

export const DEFAULT_REPORT_LAYOUT: ReportLayoutModel = {
  pageSettings: {
    size: 'A4',
    orientation: 'portrait',
    margins: { top: 20, bottom: 20, left: 15, right: 15 },
  },
  header: {
    show: true,
    companyName: 'Apex Euro Refining Complex',
    titleTemplate: 'DAILY TURNAROUND REPORT',
  },
  footer: {
    show: true,
    showPageNumbers: true,
    confidentiality: 'STRICTLY CONFIDENTIAL — TURNAROUND MANAGEMENT ONLY',
    disclaimerText: 'Generated from authoritative STO system records.',
  },
  sections: [
    {
      id: 'sec_header',
      title: 'Report Header & Overview',
      columns: 12,
      components: [
        {
          id: 'comp_title',
          type: 'text.title',
          position: { row: 0, col: 0, span: 8 },
          configuration: { text: 'DAILY TURNAROUND PROGRESS REPORT' },
        },
        {
          id: 'comp_conf',
          type: 'control.confidentiality_banner',
          position: { row: 0, col: 8, span: 4 },
          configuration: { label: 'CONFIDENTIAL', color: '#DC2626' },
        },
      ],
    },
    {
      id: 'sec_kpis',
      title: 'Executive KPIs',
      columns: 12,
      components: [
        {
          id: 'comp_kpi_deck',
          type: 'kpi.group',
          position: { row: 0, col: 0, span: 12 },
          configuration: { columns: 4 },
        },
      ],
    },
    {
      id: 'sec_data',
      title: 'Authoritative Activity Progress',
      columns: 12,
      components: [
        {
          id: 'comp_table_act',
          type: 'table.activity',
          position: { row: 0, col: 0, span: 12 },
          configuration: {
            columns: ['activity_number', 'description', 'discipline', 'contractor', 'progress_percent', 'status'],
            pageSize: 50,
            repeatHeaderPdf: true,
          },
        },
      ],
    },
    {
      id: 'sec_footer',
      title: 'Sign-off & Governance',
      columns: 12,
      components: [
        {
          id: 'comp_filter_sum',
          type: 'control.filter_summary',
          position: { row: 0, col: 0, span: 6 },
          configuration: { showHash: true },
        },
        {
          id: 'comp_signatures',
          type: 'control.signature_block',
          position: { row: 0, col: 6, span: 6 },
          configuration: { signatures: ['Shift Superintendent', 'Planning Lead'] },
        },
      ],
    },
  ],
  presentationProfile: {
    primaryColor: '#0D2137',
    accentColor: '#E8701A',
    fontFamily: 'Inter, Arial, sans-serif',
    fontSizeBase: 12,
  },
};

export class ReportDesignerStateManager {
  private current: ReportLayoutModel;
  private undoStack: ReportLayoutModel[] = [];
  private redoStack: ReportLayoutModel[] = [];
  private listeners: Set<(layout: ReportLayoutModel) => void> = new Set();
  private maxUndo: number = 50;

  constructor(initialLayout?: Partial<ReportLayoutModel>) {
    this.current = this.deepClone(initialLayout ? { ...DEFAULT_REPORT_LAYOUT, ...initialLayout } : DEFAULT_REPORT_LAYOUT);
  }

  private deepClone<T>(val: T): T {
    return JSON.parse(JSON.stringify(val));
  }

  private pushHistory() {
    this.undoStack.push(this.deepClone(this.current));
    if (this.undoStack.length > this.maxUndo) {
      this.undoStack.shift();
    }
    this.redoStack = []; // clear redo on new action
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.getLayout()));
  }

  public subscribe(listener: (layout: ReportLayoutModel) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getLayout(): ReportLayoutModel {
    return this.deepClone(this.current);
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): boolean {
    if (!this.canUndo()) return false;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(this.deepClone(this.current));
    this.current = previous;
    this.notify();
    return true;
  }

  public redo(): boolean {
    if (!this.canRedo()) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(this.deepClone(this.current));
    this.current = next;
    this.notify();
    return true;
  }

  public reset(baseline?: ReportLayoutModel) {
    this.pushHistory();
    this.current = this.deepClone(baseline || DEFAULT_REPORT_LAYOUT);
    this.notify();
  }

  public addSection(title: string, columns = 12): string {
    this.pushHistory();
    const id = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.current.sections.push({
      id,
      title,
      columns,
      components: [],
    });
    this.notify();
    return id;
  }

  public removeSection(sectionId: string): boolean {
    const idx = this.current.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return false;
    this.pushHistory();
    this.current.sections.splice(idx, 1);
    this.notify();
    return true;
  }

  public reorderSections(newSectionIds: string[]) {
    this.pushHistory();
    const map = new Map(this.current.sections.map((s) => [s.id, s]));
    this.current.sections = newSectionIds
      .map((id) => map.get(id))
      .filter((s): s is ReportDesignerSection => s !== undefined);
    this.notify();
  }

  public addComponent(
    sectionId: string,
    type: string,
    configuration: Record<string, any> = {},
    position?: ComponentPlacement
  ): string {
    const section = this.current.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error(`Section "${sectionId}" not found`);

    this.pushHistory();
    const id = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const compPos: ComponentPlacement = position || {
      row: section.components.length,
      col: 0,
      span: section.columns,
    };

    section.components.push({
      id,
      type,
      position: compPos,
      configuration,
    });
    this.notify();
    return id;
  }

  public removeComponent(componentId: string): boolean {
    for (const sec of this.current.sections) {
      const idx = sec.components.findIndex((c) => c.id === componentId);
      if (idx !== -1) {
        this.pushHistory();
        sec.components.splice(idx, 1);
        this.notify();
        return true;
      }
    }
    return false;
  }

  public duplicateComponent(componentId: string): string | null {
    for (const sec of this.current.sections) {
      const comp = sec.components.find((c) => c.id === componentId);
      if (comp) {
        this.pushHistory();
        const cloneId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const clone: PlacedReportComponent = {
          ...this.deepClone(comp),
          id: cloneId,
          position: { ...comp.position, row: comp.position.row + 1 },
        };
        sec.components.push(clone);
        this.notify();
        return cloneId;
      }
    }
    return null;
  }

  public updateComponentConfig(componentId: string, updates: Record<string, any>): boolean {
    for (const sec of this.current.sections) {
      const comp = sec.components.find((c) => c.id === componentId);
      if (comp) {
        this.pushHistory();
        comp.configuration = { ...comp.configuration, ...updates };
        this.notify();
        return true;
      }
    }
    return false;
  }

  public updateComponentPosition(componentId: string, newPos: Partial<ComponentPlacement>): boolean {
    for (const sec of this.current.sections) {
      const comp = sec.components.find((c) => c.id === componentId);
      if (comp) {
        this.pushHistory();
        comp.position = { ...comp.position, ...newPos };
        this.notify();
        return true;
      }
    }
    return false;
  }

  public moveComponent(componentId: string, targetSectionId: string, newIndex?: number): boolean {
    let sourceComp: PlacedReportComponent | null = null;

    // Find and remove from source
    for (const sec of this.current.sections) {
      const idx = sec.components.findIndex((c) => c.id === componentId);
      if (idx !== -1) {
        sourceComp = sec.components.splice(idx, 1)[0];
        break;
      }
    }

    if (!sourceComp) return false;

    const targetSec = this.current.sections.find((s) => s.id === targetSectionId);
    if (!targetSec) return false;

    this.pushHistory();
    if (newIndex !== undefined && newIndex >= 0 && newIndex <= targetSec.components.length) {
      targetSec.components.splice(newIndex, 0, sourceComp);
    } else {
      targetSec.components.push(sourceComp);
    }
    this.notify();
    return true;
  }

  public updatePageSettings(settings: Partial<ReportLayoutModel['pageSettings']>) {
    this.pushHistory();
    this.current.pageSettings = { ...this.current.pageSettings, ...settings };
    this.notify();
  }

  public updatePresentation(profile: Partial<ReportLayoutModel['presentationProfile']>) {
    this.pushHistory();
    this.current.presentationProfile = { ...this.current.presentationProfile, ...profile };
    this.notify();
  }

  public updateHeaderFooter(hf: { header?: Partial<ReportLayoutModel['header']>; footer?: Partial<ReportLayoutModel['footer']> }) {
    this.pushHistory();
    if (hf.header) this.current.header = { ...this.current.header, ...hf.header };
    if (hf.footer) this.current.footer = { ...this.current.footer, ...hf.footer };
    this.notify();
  }
}
