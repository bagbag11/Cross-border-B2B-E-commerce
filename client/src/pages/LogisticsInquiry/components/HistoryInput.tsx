import { useState, useRef, useEffect } from 'react';
import { Clock, X, Trash2 } from 'lucide-react';
import { Input } from '@client/src/components/ui/input';
import type { HistoryRecord } from '../hooks/useInputHistory';

interface HistoryInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: 'text' | 'number';
  step?: string;
  label?: string;
  history: string[];
  onClearHistory?: () => void;
}

export function HistoryInput({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  type = 'text',
  step,
  label,
  history,
  onClearHistory,
}: HistoryInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    setIsOpen(true);
    onFocus?.();
  };

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const hasHistory = history.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type={type}
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={onBlur}
          className="pr-8"
        />
        {hasHistory && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="查看历史输入"
          >
            <Clock className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && hasHistory && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-sm shadow-md max-h-48 overflow-auto">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-muted/50">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              历史输入
            </span>
            {onClearHistory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearHistory();
                }}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                清空
              </button>
            )}
          </div>
          <ul className="py-1">
            {history.map((item, index) => (
              <li
                key={index}
                className="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between group"
                onClick={() => handleSelect(item)}
              >
                <span className="truncate">{item}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 从 history 中移除该项
                    const newHistory = history.filter((_, i) => i !== index);
                    // 通知父组件更新
                    if (newHistory.length === 0) {
                      setIsOpen(false);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
