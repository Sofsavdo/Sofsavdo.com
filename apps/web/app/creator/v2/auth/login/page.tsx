/**
 * Simplified Creator Login Page
 * 
 * Phone-only login with SMS verification.
 * Focuses on simplicity and speed - should take less than 30 seconds.
 */

'use client';

import { useState } from 'react';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { authV2Service } from '@/services/v2/auth-v2.service';
import { useRouter } from 'next/navigation';

export default function SimplifiedLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Enter phone
  const [phone, setPhone] = useState('');
  
  // Step 2: SMS verification
  const [smsCode, setSmsCode] = useState('');
  
  const handleStep1 = async () => {
    if (!phone) return;
    
    setLoading(true);
    try {
      await authV2Service.phoneLogin({ phone });
      setStep(2);
    } catch (error) {
      console.error('Login failed:', error);
      alert('Phone number not found. Please register first.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStep2 = async () => {
    setLoading(true);
    try {
      const response = await authV2Service.verifySms({ phone, code: smsCode });
      
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
      console.error('SMS verification failed:', error);
      alert('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <SimplifiedCard className="w-full max-w-md">
        <SimplifiedCardHeader>
          <SimplifiedCardTitle className="text-center">
            Welcome Back
          </SimplifiedCardTitle>
          <p className="text-center text-gray-600 text-sm mt-2">
            {step === 1 && 'Step 1 of 2'}
            {step === 2 && 'Step 2 of 2'}
          </p>
        </SimplifiedCardHeader>
        
        <SimplifiedCardContent>
          {step === 1 && (
            <div className="space-y-4">
              <SimplifiedInput
                label="Phone Number"
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                helperText="We'll send you a verification code"
              />
              
              <SimplifiedButton
                variant="primary"
                fullWidth
                onClick={handleStep1}
                loading={loading}
                disabled={!phone}
              >
                Send Code
              </SimplifiedButton>
              
              <p className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <a href="/creator/v2/auth/register" className="text-blue-600 hover:underline">
                  Register
                </a>
              </p>
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600">
                  We sent a code to <strong>{phone}</strong>
                </p>
              </div>
              
              <SimplifiedInput
                label="SMS Code"
                placeholder="123456"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                helperText="Enter the 6-digit code"
                maxLength={6}
              />
              
              <SimplifiedButton
                variant="primary"
                fullWidth
                onClick={handleStep2}
                loading={loading}
                disabled={smsCode.length !== 6}
              >
                Login & Start Earning
              </SimplifiedButton>
              
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => setStep(1)}
                >
                  Back
                </SimplifiedButton>
                <SimplifiedButton
                  variant="ghost"
                  fullWidth
                  onClick={() => {/* Resend logic */}}
                >
                  Resend
                </SimplifiedButton>
              </div>
            </div>
          )}
        </SimplifiedCardContent>
      </SimplifiedCard>
    </div>
  );
}
