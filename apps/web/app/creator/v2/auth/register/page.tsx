/**
 * Simplified Creator Registration Page
 * 
 * 3-step registration process:
 * 1. Enter name and phone
 * 2. Enter city and social link (optional)
 * 3. Verify SMS code
 * 
 * Focuses on simplicity and speed - should take less than 30 seconds.
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Name and phone
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Step 2: City and social (optional)
  const [city, setCity] = useState('');
  const [socialLink, setSocialLink] = useState('');
  
  // Step 3: SMS verification
  const [smsCode, setSmsCode] = useState('');
  
  const handleStep1 = async () => {
    if (!displayName || !phone) return;
    setStep(2);
  };
  
  const handleStep2 = async () => {
    setLoading(true);
    try {
      const dto: SimplifiedRegisterDto = {
        displayName,
        phone,
        city: city || undefined,
        socialLink: socialLink || undefined,
      };
      
      const response = await authV2Service.register(dto);
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('userId', response.userId);
      if (response.creatorId) {
        localStorage.setItem('creatorId', response.creatorId);
      }
      
      setStep(3);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStep3 = async () => {
    setLoading(true);
    try {
      await authV2Service.verifySms({ phone, code: smsCode });
      
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
            {step === 1 && 'Create Your Account'}
            {step === 2 && 'Almost There'}
            {step === 3 && 'Verify Your Phone'}
          </SimplifiedCardTitle>
          <p className="text-center text-gray-600 text-sm mt-2">
            {step === 1 && 'Step 1 of 3'}
            {step === 2 && 'Step 2 of 3'}
            {step === 3 && 'Step 3 of 3'}
          </p>
        </SimplifiedCardHeader>
        
        <SimplifiedCardContent>
          {step === 1 && (
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
                helperText="We'll send you a verification code"
              />
              
              <SimplifiedButton
                variant="primary"
                fullWidth
                onClick={handleStep1}
                disabled={!displayName || !phone}
              >
                Continue
              </SimplifiedButton>
              
              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <a href="/creator/v2/auth/login" className="text-blue-600 hover:underline">
                  Login
                </a>
              </p>
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4">
              <SimplifiedInput
                label="City (Optional)"
                placeholder="Tashkent"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              
              <SimplifiedInput
                label="Social Media Link (Optional)"
                placeholder="https://instagram.com/malika"
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                helperText="Share your Instagram or TikTok profile"
              />
              
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => setStep(1)}
                >
                  Back
                </SimplifiedButton>
                <SimplifiedButton
                  variant="primary"
                  fullWidth
                  onClick={handleStep2}
                  loading={loading}
                >
                  Create Account
                </SimplifiedButton>
              </div>
            </div>
          )}
          
          {step === 3 && (
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
                onClick={handleStep3}
                loading={loading}
                disabled={smsCode.length !== 6}
              >
                Verify & Start Earning
              </SimplifiedButton>
              
              <p className="text-center text-sm text-gray-600">
                Didn't receive a code?{' '}
                <button 
                  className="text-blue-600 hover:underline"
                  onClick={() => {/* Resend logic */}}
                >
                  Resend
                </button>
              </p>
            </div>
          )}
        </SimplifiedCardContent>
      </SimplifiedCard>
    </div>
  );
}
