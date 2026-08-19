import { useState, useEffect, useCallback } from 'react';
import {
  getUserInputHistory,
  saveUserInputHistory,
  clearUserInputHistory,
} from '@client/src/api/logistics-inquiry';

export type HistoryRecord = {
  country: string;
  city: string;
  postalCode: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  quantity: string;
  packagesCount: string;
  category: string;
  packagingType: string;
  declaredValue: string;
  itemName: string;
  customsType: string;
  selectedRoute: string;
};

const FIELD_NAMES: (keyof HistoryRecord)[] = [
  'country', 'city', 'postalCode', 'weight', 'length', 'width', 'height',
  'quantity', 'packagesCount', 'category', 'packagingType', 'declaredValue',
  'itemName', 'customsType', 'selectedRoute',
];

export function useInputHistory() {
  const [fieldHistories, setFieldHistories] = useState<Record<keyof HistoryRecord, string[]>>({
    country: [],
    city: [],
    postalCode: [],
    weight: [],
    length: [],
    width: [],
    height: [],
    quantity: [],
    packagesCount: [],
    category: [],
    packagingType: [],
    declaredValue: [],
    itemName: [],
    customsType: [],
    selectedRoute: [],
  });

  // 加载所有字段的历史记录
  useEffect(() => {
    const loadHistories = async () => {
       const histories: Record<keyof HistoryRecord, string[]> = {
        country: [],
        city: [],
        postalCode: [],
        weight: [],
        length: [],
        width: [],
        height: [],
        quantity: [],
        packagesCount: [],
        category: [],
      packagingType: [],
      declaredValue: [],
      itemName: [],
      customsType: [],
      selectedRoute: [],
    };

      for (const fieldName of FIELD_NAMES) {
        try {
          const response = await getUserInputHistory(fieldName);
          histories[fieldName] = response.items.map((item) => item.fieldValue);
        } catch {
          histories[fieldName] = [];
        }
      }

      setFieldHistories(histories);
    };

    loadHistories();
  }, []);

  // 添加新记录
  const addHistory = useCallback(async (record: HistoryRecord) => {
    // 过滤掉空值过多的记录（至少要有国家和重量）
    if (!record.country || !record.weight) return;

    const records: { fieldName: string; fieldValue: string }[] = [];

    for (const [key, value] of Object.entries(record)) {
      if (value && value.trim() !== '') {
        records.push({ fieldName: key, fieldValue: value });
      }
    }

    if (records.length > 0) {
      await saveUserInputHistory({ records });

      // 更新本地状态
      setFieldHistories((prev) => {
        const updated = { ...prev };
        for (const { fieldName, fieldValue } of records) {
          const current = updated[fieldName as keyof HistoryRecord];
          if (!current.includes(fieldValue)) {
            updated[fieldName as keyof HistoryRecord] = [fieldValue, ...current].slice(0, 10);
          }
        }
        return updated;
      });
    }
  }, []);

  // 清空历史
  const clearHistory = useCallback(async () => {
    await clearUserInputHistory();
    setFieldHistories({
      country: [],
      city: [],
      postalCode: [],
      weight: [],
      length: [],
      width: [],
      height: [],
      quantity: [],
      packagesCount: [],
      category: [],
      packagingType: [],
      declaredValue: [],
      itemName: [],
      customsType: [],
      selectedRoute: [],
    });
  }, []);

  // 获取某个字段的所有历史值
  const getFieldHistory = useCallback(
    (fieldName: keyof HistoryRecord): string[] => {
      return fieldHistories[fieldName] || [];
    },
    [fieldHistories]
  );

  return {
    history: [],
    addHistory,
    clearHistory,
    getFieldHistory,
  };
}
