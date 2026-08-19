import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import InquiryForm from './InquiryForm';
import InquiryResults from './InquiryResults';
import { submitInquiry, saveUserInputHistory } from '@client/src/api/logistics-inquiry';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { InquiryResultItem, DimensionGroup } from '@shared/api.interface';

const LogisticsInquiryPage = () => {
  const location = useLocation();
  const historyData = location.state as Partial<{
    country: string;
    city: string;
    postalCode: string;
    weight: number;
    length: number;
    width: number;
    height: number;
    quantity: number;
    packagesCount: number;
    category: string;
    packagingType: string;
    declaredValue: number;
    itemName: string;
  }> | null;

  const [results, setResults] = useState<InquiryResultItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [lastFormData, setLastFormData] = useState<Record<string, string> | null>(null);

  const handleInquiry = async (data: {
    country: string;
    city: string;
    postalCode: string;
    weight: number;
    length: number;
    width: number;
    height: number;
    quantity: number;
    packagesCount: number;
    category: string;
    packagingType: string;
    declaredValue: number;
    dimensionGroups?: DimensionGroup[];
  }): Promise<void> => {
    setLoading(true);
    setHasSearched(true);
    try {
      const response = await submitInquiry({
        country: data.country,
        city: data.city || '',
        postalCode: data.postalCode || '',
        weight: data.weight,
        length: data.length || 0,
        width: data.width || 0,
        height: data.height || 0,
        quantity: data.quantity,
        packagesCount: data.packagesCount || 1,
        category: data.category || '',
        packagingType: data.packagingType || '',
        declaredValue: data.declaredValue || 0,
        expectedDays: 0,
        dimensionGroups: data.dimensionGroups,
      });
       setResults(response.items);
       setSelectedRoutes([]);
       setLastFormData({
         country: data.country,
         city: data.city || '',
         postalCode: data.postalCode || '',
         weight: String(data.weight),
         length: String(data.length || ''),
         width: String(data.width || ''),
         height: String(data.height || ''),
         quantity: String(data.quantity),
         packagesCount: String(data.packagesCount || 1),
         category: data.category || '',
         packagingType: data.packagingType || '',
         declaredValue: String(data.declaredValue || ''),
       });
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

   const handleToggleSelect = async (routeId: string, routeName: string) => {
     const newSelected = selectedRoutes.includes(routeId)
       ? selectedRoutes.filter((id) => id !== routeId)
       : [...selectedRoutes, routeId];
     setSelectedRoutes(newSelected);

     if (lastFormData && newSelected.length > 0) {
       try {
         const records: { fieldName: string; fieldValue: string }[] = [];
         for (const [key, value] of Object.entries(lastFormData)) {
           if (value && value.trim() !== '') {
             records.push({ fieldName: key, fieldValue: value });
           }
         }
         const selectedNames = newSelected
           .map((id) => results.find((r) => r.routeId === id)?.routeName)
           .filter(Boolean)
           .join(' | ');
         if (selectedNames) {
           records.push({ fieldName: 'selectedRoute', fieldValue: selectedNames });
         }
         await saveUserInputHistory({ records });
       } catch (error) {
         logger.error('保存选中路线到历史记录失败', error);
       }
     }
   };

   return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-[40%]">
        <InquiryForm
          onSubmit={handleInquiry}
          loading={loading}
          initialValues={historyData ?? undefined}
        />
      </div>
      <div className="w-full lg:w-[60%]">
         <InquiryResults
           items={results}
           loading={loading}
           hasSearched={hasSearched}
           selectedRoutes={selectedRoutes}
           onToggleSelect={handleToggleSelect}
         />
      </div>
    </div>
  );
};

export default LogisticsInquiryPage;
