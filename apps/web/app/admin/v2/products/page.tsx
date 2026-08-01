/**
 * Simplified Admin Products Management Page
 * 
 * A clean, simple products management page for admins.
 * List, create, edit, and delete products.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { productsV2Service, type SimplifiedProductDto, type CreateSimplifiedProductDto } from '@/services/v2/products-v2.service';

export default function SimplifiedAdminProductsPage() {
  const [products, setProducts] = useState<SimplifiedProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SimplifiedProductDto | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceMinor, setPriceMinor] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('');
  const [images, setImages] = useState('');
  const [category, setCategory] = useState('');
  
  useEffect(() => {
    loadProducts();
  }, []);
  
  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await productsV2Service.list();
      setProducts(response.items);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = () => {
    setEditingProduct(null);
    setTitle('');
    setDescription('');
    setPriceMinor('');
    setCommissionPercent('');
    setImages('');
    setCategory('');
    setModalOpen(true);
  };
  
  const handleEdit = (product: SimplifiedProductDto) => {
    setEditingProduct(product);
    setTitle(product.title);
    setDescription(product.description || '');
    setPriceMinor(product.priceMinor.toString());
    setCommissionPercent(product.commissionPercent.toString());
    setImages(product.images.join(', '));
    setCategory(product.category || '');
    setModalOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await productsV2Service.remove(id);
      await loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product. Please try again.');
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const dto: CreateSimplifiedProductDto = {
        title,
        description: description || undefined,
        priceMinor: parseInt(priceMinor, 10),
        commissionPercent: parseInt(commissionPercent, 10),
        images: images.split(',').map(img => img.trim()).filter(Boolean),
        category: category || undefined,
      };
      
      if (editingProduct) {
        await productsV2Service.update(editingProduct.id, dto);
      } else {
        await productsV2Service.create(dto);
      }
      
      setModalOpen(false);
      await loadProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Failed to save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(search.toLowerCase())
  );
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to dashboard */}}>
                Dashboard
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to orders */}}>
                Orders
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to creators */}}>
                Creators
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to earnings */}}>
                Earnings
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to settings */}}>
                Settings
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex gap-4">
            <SimplifiedInput
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <SimplifiedButton variant="primary" onClick={handleCreate}>
              Add Product
            </SimplifiedButton>
          </div>
          
          {/* Products Table */}
          <SimplifiedCard>
            <SimplifiedCardContent>
              {filteredProducts.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  {search ? 'No products found matching your search.' : 'No products yet. Add your first product!'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Product</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Price</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Commission</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                  src={product.images[0] || '/placeholder.png'}
                                  alt={product.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{product.title}</p>
                                {product.category && (
                                  <p className="text-sm text-gray-600">{product.category}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {formatPrice(product.priceMinor)}
                          </td>
                          <td className="py-3 px-4">
                            <SimplifiedBadge variant="success">{product.commissionPercent}%</SimplifiedBadge>
                          </td>
                          <td className="py-3 px-4">
                            <SimplifiedBadge variant={product.status === 'ACTIVE' ? 'success' : 'neutral'}>
                              {product.status}
                            </SimplifiedBadge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <SimplifiedButton
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(product)}
                              >
                                Edit
                              </SimplifiedButton>
                              <SimplifiedButton
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(product.id)}
                              >
                                Delete
                              </SimplifiedButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
        
        {/* Create/Edit Modal */}
        <SimplifiedModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingProduct ? 'Edit Product' : 'Add New Product'}
          size="lg"
        >
          <div className="space-y-4">
            <SimplifiedInput
              label="Product Title"
              placeholder="Face Serum for Glowing Skin"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            
            <SimplifiedInput
              label="Description"
              placeholder="Product description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <SimplifiedInput
                label="Price (in so'm)"
                type="number"
                placeholder="150000"
                value={priceMinor}
                onChange={(e) => setPriceMinor(e.target.value)}
              />
              
              <SimplifiedInput
                label="Commission (%)"
                type="number"
                placeholder="20"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
              />
            </div>
            
            <SimplifiedInput
              label="Images (comma-separated URLs)"
              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              value={images}
              onChange={(e) => setImages(e.target.value)}
            />
            
            <SimplifiedInput
              label="Category"
              placeholder="Beauty"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            
            <div className="flex gap-2">
              <SimplifiedButton
                variant="outline"
                fullWidth
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </SimplifiedButton>
              <SimplifiedButton
                variant="primary"
                fullWidth
                onClick={handleSave}
                loading={saving}
                disabled={!title || !priceMinor || !commissionPercent}
              >
                {editingProduct ? 'Update' : 'Create'}
              </SimplifiedButton>
            </div>
          </div>
        </SimplifiedModal>
      </div>
    </div>
  );
}
