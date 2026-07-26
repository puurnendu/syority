'use client';

import { useState, useRef } from 'react';
import { PRINT_VARIABLES, type ZoneItem } from '@/types/printSettings.types';

function nextId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PickerTab = 'text' | 'variable' | 'image';

const VAR_GROUPS = ['All', 'Organisation', 'Workpack', 'Schedule', 'Page'] as const;

type Props = {
  onAdd: (item: ZoneItem) => void;
  defaultTextColor?: string;
  orgLogoUrl?: string | null;
  logoLibrary: { id: string; name: string; s3_path: string; url: string }[];
  onUploadLogo?: (file: File, name: string) => Promise<{ id: string; name: string; s3_path: string; url: string }>;
};

export function ZoneItemPicker({
  onAdd,
  defaultTextColor = '#FFFFFF',
  orgLogoUrl,
  logoLibrary,
  onUploadLogo,
}: Props) {
  const [tab, setTab] = useState<PickerTab>('text');
  const [varCategory, setVarCategory] = useState<string>('All');
  const [text, setText] = useState('');
  const [textFontSize, setTextFontSize] = useState(11);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textColor, setTextColor] = useState(defaultTextColor);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [varFontSize, setVarFontSize] = useState(11);
  const [varBold, setVarBold] = useState(false);
  const [varItalic, setVarItalic] = useState(false);
  const [varColor, setVarColor] = useState(defaultTextColor);
  const [selectedLogo, setSelectedLogo] = useState<{ id: string; name: string; url: string; s3_path: string } | null>(null);
  const [logoWidth, setLogoWidth] = useState(80);
  const [logoHeight, setLogoHeight] = useState(28);
  const [logoFit, setLogoFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredVariables =
    varCategory === 'All'
      ? PRINT_VARIABLES
      : PRINT_VARIABLES.filter((v) => (v.group ?? 'Other') === varCategory);

  const handleAddText = () => {
    if (!text.trim()) return;
    onAdd({
      id: nextId(),
      type: 'text',
      text: text.trim(),
      fontSize: textFontSize,
      fontWeight: textBold ? 'bold' : 'normal',
      fontStyle: textItalic ? 'italic' : 'normal',
      color: textColor,
    });
    setText('');
  };

  const handleAddVariable = () => {
    if (!selectedVariable) return;
    const v = PRINT_VARIABLES.find((x) => x.code === selectedVariable);
    onAdd({
      id: nextId(),
      type: 'variable',
      variableCode: selectedVariable,
      variableLabel: v?.label ?? selectedVariable,
      fontSize: varFontSize,
      fontWeight: varBold ? 'bold' : 'normal',
      fontStyle: varItalic ? 'italic' : 'normal',
      color: varColor,
    });
    setSelectedVariable(null);
  };

  const handleAddImage = (imagePath: string, imageUrl: string, imageName: string) => {
    onAdd({
      id: nextId(),
      type: 'image',
      imagePath,
      imageUrl,
      imageName,
      imageWidthPx: logoWidth,
      imageHeightPx: logoHeight,
      imageObjectFit: logoFit,
    });
    setSelectedLogo(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadLogo) return;
    setUploading(true);
    try {
      const result = await onUploadLogo(file, file.name.replace(/\.[^.]+$/, ''));
      setSelectedLogo({ id: result.id, name: result.name, url: result.url, s3_path: result.s3_path });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        {(['text', 'variable', 'image'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'text' && 'Text'}
            {t === 'variable' && 'Variable'}
            {t === 'image' && 'Image / Logo'}
          </button>
        ))}
      </div>

      {tab === 'text' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
              placeholder="Type your text"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">Size:</span>
            <input
              type="range"
              min={8}
              max={16}
              value={textFontSize}
              onChange={(e) => setTextFontSize(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-gray-600 w-8">{textFontSize}px</span>
            <button
              type="button"
              onClick={() => setTextBold(!textBold)}
              className={`rounded px-2 py-1 text-sm font-bold border ${textBold ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-300'}`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => setTextItalic(!textItalic)}
              className={`rounded px-2 py-1 text-sm italic border ${textItalic ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-300'}`}
            >
              I
            </button>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              Color:
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-6 w-8 rounded border border-gray-300 cursor-pointer"
              />
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddText}
            disabled={!text.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Apply to Section
          </button>
        </div>
      )}

      {tab === 'variable' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Category</label>
            <div className="flex flex-wrap gap-1">
              {VAR_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setVarCategory(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    varCategory === g ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto rounded border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {filteredVariables.map((v) => (
                <li key={v.code}>
                  <button
                    type="button"
                    onClick={() => setSelectedVariable(selectedVariable === v.code ? null : v.code)}
                    className={`w-full text-left px-3 py-2 text-sm flex justify-between items-center gap-2 ${
                      selectedVariable === v.code ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-mono text-gray-600">{v.code}</span>
                    <span className="truncate">{v.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">Size:</span>
            <input
              type="range"
              min={8}
              max={16}
              value={varFontSize}
              onChange={(e) => setVarFontSize(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-gray-600 w-8">{varFontSize}px</span>
            <button
              type="button"
              onClick={() => setVarBold(!varBold)}
              className={`rounded px-2 py-1 text-sm font-bold border ${varBold ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-300'}`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => setVarItalic(!varItalic)}
              className={`rounded px-2 py-1 text-sm italic border ${varItalic ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-300'}`}
            >
              I
            </button>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              Color:
              <input
                type="color"
                value={varColor}
                onChange={(e) => setVarColor(e.target.value)}
                className="h-6 w-8 rounded border border-gray-300 cursor-pointer"
              />
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddVariable}
            disabled={!selectedVariable}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Apply to Section
          </button>
        </div>
      )}

      {tab === 'image' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Upload logo or pick from library
            </label>
            {onUploadLogo && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : '+ Upload new'}
                </button>
              </>
            )}
          </div>
          {orgLogoUrl && (
            <div className="flex items-center gap-2 p-2 rounded border border-gray-200 bg-white">
              <img
                src={orgLogoUrl.startsWith('http') ? orgLogoUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${orgLogoUrl}`}
                alt=""
                className="h-10 w-14 object-contain bg-white rounded"
              />
              <div className="flex-1 text-xs text-gray-600">Organisation logo</div>
              <button
                type="button"
                onClick={() => handleAddImage('org-logo', orgLogoUrl, 'Org Logo')}
                className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
              >
                Insert
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {logoLibrary.map((logo) => (
              <div
                key={logo.id}
                className={`flex flex-col items-center rounded border p-2 ${
                  selectedLogo?.id === logo.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedLogo(selectedLogo?.id === logo.id ? null : { id: logo.id, name: logo.name, url: logo.url, s3_path: logo.s3_path })}
                  className="h-12 w-14 flex items-center justify-center overflow-hidden rounded bg-gray-50"
                >
                  <img
                    src={logo.url.startsWith('http') ? logo.url : `${typeof window !== 'undefined' ? window.location.origin : ''}${logo.url}`}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </button>
                <span className="text-xs truncate w-full text-center mt-1">{logo.name}</span>
                <button
                  type="button"
                  onClick={() => handleAddImage(logo.s3_path, logo.url, logo.name)}
                  className="mt-1 rounded bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200"
                >
                  Insert
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Width</label>
              <input
                type="number"
                min={20}
                max={200}
                value={logoWidth}
                onChange={(e) => setLogoWidth(Number(e.target.value))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Height</label>
              <input
                type="number"
                min={10}
                max={80}
                value={logoHeight}
                onChange={(e) => setLogoHeight(Number(e.target.value))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Fit</label>
              <select
                value={logoFit}
                onChange={(e) => setLogoFit(e.target.value as 'contain' | 'cover' | 'fill')}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
