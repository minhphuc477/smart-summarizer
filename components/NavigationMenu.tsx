"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, BarChart3, PenTool } from 'lucide-react';

export default function NavigationMenu() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/canvas', label: 'Canvas', icon: PenTool },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="flex gap-2">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;
        
        return (
          <Link key={link.href} href={link.href}>
            <Button 
              variant={isActive ? "default" : "ghost"} 
              size="sm"
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{link.label}</span>
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}
