'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
  variant?: 'ghost' | 'outline' | 'secondary' | 'primary' | 'danger';
}

export function BackButton({ 
  href, 
  label = 'Back to previous page', 
  className = '',
  variant = 'ghost'
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={`inline-flex items-center ${className}`}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
