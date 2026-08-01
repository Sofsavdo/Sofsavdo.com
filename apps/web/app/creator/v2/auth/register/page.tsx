/**
 * Simplified Creator Registration Page
 * 
 * Ultra-simple registration: just name, phone, and password
 * Single step - takes less than 30 seconds
 */

'use client';

import { useState } from 'react';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { authV2Service, type SimplifiedRegisterDto } from '@/services/v2/auth-v2.service';
import { useRouter } from 'next/navigation';

export default function SimplifiedRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = async () => {
    if (!displayName || !phone || !password) {
      alert('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const dto: SimplifiedRegisterDto = {
        displayName,
        phone,
      };
      
      const response = await authV2Service.register(dto);
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('userId', response.userId);
      if (response.creatorId) {
        localStorage.setItem('creatorId', response.creatorId);
      }
      
      // Redirect to dashboard
      router.push('/creator/v2/products');
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <SimplifiedCard className="w-full max-w-md">
        <SimplifiedCardHeader>
          <SimplifiedCardTitle className="text-center">
            Create Your Account
          </SimplifiedCardTitle>
          <p className="text-center text-gray-600 text-sm mt-2">
            Start earning in 30 seconds
          </p>
        </SimplifiedCardHeader>
        
        <SimplifiedCardContent>
          <div className="space-y-4">
            <SimplifiedInput
              label="Your Name"
              placeholder="Malika"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            
            <SimplifiedInput
              label="Phone Number"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              helperText="We'll contact you for verification"
            />
            
            <SimplifiedInput
              label="Password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="At least 6 characters"
            />
            
            <SimplifiedButton
              variant="primary"
              fullWidth
              onClick={handleSubmit}
              loading={loading}
              disabled={!displayName || !phone || !password}
            >
              Create Account
            </SimplifiedButton>
            
            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/creator/v2/auth/login" className="text-blue-600 hover:underline">
                Login
              </a>
            </p>
          </div>
        </SimplifiedCardContent>
      </SimplifiedCard>
    </div>
  );
}
