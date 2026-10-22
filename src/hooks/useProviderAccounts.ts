import { useState, useEffect } from 'react';

export interface CloudinaryAccount {
  id: string;
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface ShopifyAccount {
  id: string;
  storeDomain: string;
  accessToken: string;
}

export interface ImgBbAccount {
  id: string;
  apiKey: string;
}

export function useProviderAccounts() {
  const [cloudinaryAccounts, setCloudinaryAccounts] = useState<CloudinaryAccount[]>(() => {
      try {
          const stored = localStorage.getItem('upload_cloudinary_accounts');
          if (stored) return JSON.parse(stored);
      } catch (e) {}
      
      return [{
          id: 'default',
          cloudName: localStorage.getItem('upload_cloud_name') || '',
          apiKey: localStorage.getItem('upload_api_key') || '',
          apiSecret: localStorage.getItem('upload_api_secret') || ''
      }];
  });

  const [shopifyAccounts, setShopifyAccounts] = useState<ShopifyAccount[]>(() => {
      try {
          const stored = localStorage.getItem('upload_shopify_accounts');
          if (stored) return JSON.parse(stored);
      } catch (e) {}
      
      return [{
          id: 'default',
          storeDomain: localStorage.getItem('shopify_store_domain') || '',
          accessToken: localStorage.getItem('shopify_access_token') || ''
      }];
  });

  const [imgbbAccounts, setImgbbAccounts] = useState<ImgBbAccount[]>(() => {
      try {
          const stored = localStorage.getItem('upload_imgbb_accounts');
          if (stored) return JSON.parse(stored);
      } catch(e) {}
      return [{
          id: 'default',
          apiKey: localStorage.getItem('upload_imgbb_key') || localStorage.getItem('imgbb_api_key') || ''
      }];
  });

  useEffect(() => {
      localStorage.setItem('upload_cloudinary_accounts', JSON.stringify(cloudinaryAccounts));
      if (cloudinaryAccounts && cloudinaryAccounts[0]) {
          localStorage.setItem('upload_cloud_name', cloudinaryAccounts[0].cloudName || '');
          localStorage.setItem('upload_api_key', cloudinaryAccounts[0].apiKey || '');
          localStorage.setItem('upload_api_secret', cloudinaryAccounts[0].apiSecret || '');
      }
  }, [cloudinaryAccounts]);

  useEffect(() => {
      localStorage.setItem('upload_shopify_accounts', JSON.stringify(shopifyAccounts));
  }, [shopifyAccounts]);

  useEffect(() => {
      localStorage.setItem('upload_imgbb_accounts', JSON.stringify(imgbbAccounts));
  }, [imgbbAccounts]);

  return {
      cloudinaryAccounts, setCloudinaryAccounts,
      shopifyAccounts, setShopifyAccounts,
      imgbbAccounts, setImgbbAccounts
  };
}
