
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutGrid,
  MessageSquare,
  FolderKanban,
  Sparkles,
  ListChecks,
  HelpCircle,
  ClipboardCheck,
  CircleUser,
  MessageCircle,
  ShoppingCart,
  FileCheck,
  Truck,
  Calculator,
  GraduationCap,
  Banknote,
  FileSignature,
  CalendarClock,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { DistributionUser } from '@/lib/types';
import { useMemo } from 'react';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/irs', label: 'IRS Schedule', icon: CalendarClock, permission: 'accessIRS' },
  { href: '/materials-orders', label: 'Materials Orders', icon: ShoppingCart, permission: 'accessMaterials' },
  { href: '/plant-orders', label: 'Plant Orders', icon: Truck, permission: 'accessPlant' },
  { href: '/subcontract-orders', label: 'Sub Contract Orders', icon: FileSignature, permission: 'accessSubContractOrders' },
  { href: '/variations', label: 'Variations', icon: Calculator, permission: 'accessVariations' },
  { href: '/payment-notices', label: 'Payment Notices', icon: Banknote, permission: 'accessPaymentNotices' },
  { href: '/permits', label: 'Permits to Work', icon: FileCheck, permission: 'accessPermits' },
  { href: '/training', label: 'Training & Compliance', icon: GraduationCap, permission: 'accessTraining' },
  { href: '/client-instructions', label: 'Client Instructions', icon: MessageCircle, permission: 'accessClientInstructions' },
  { href: '/instructions', label: 'Site Instructions', icon: MessageSquare, permission: 'accessSiteInstructions' },
  { href: '/cleanup-notices', label: 'Clean Up Notices', icon: Sparkles, permission: 'accessCleanupNotices' },
  { href: '/snagging', label: 'Snagging', icon: ListChecks, permission: 'accessSnagging' },
  { href: '/quality-control', label: 'Quality Control', icon: ClipboardCheck, permission: 'accessQualityControl' },
  { href: '/information-requests', label: 'Info Requests', icon: HelpCircle, permission: 'accessInfoRequests' },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
];

const secondaryLinks = [
    { href: '/account', label: 'My Account', icon: CircleUser },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const db = useFirestore();

  const profileRef = useMemoFirebase(() => {
    if (!db || !user?.email) return null;
    return doc(db, 'users', user.email.toLowerCase().trim());
  }, [db, user?.email]);

  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const filteredLinks = useMemo(() => {
    if (!profile) return links.filter(l => !l.permission); // Fallback to basic links during load
    
    return links.filter(link => {
        if (!link.permission) return true;
        // If the permission field doesn't exist on older records, default to true
        const hasPermission = profile.permissions?.[link.permission as keyof typeof profile.permissions] !== false;
        return hasPermission;
    });
  }, [profile]);

  return (
    <Sidebar collapsible="icon" className="group-data-[variant=floating]:bg-card/95 group-data-[variant=floating]:backdrop-blur-sm">
      <SidebarHeader>
        <Logo className="text-sidebar-foreground transition-all duration-200 group-data-[collapsible=icon]:-ml-14" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {filteredLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(link.href) && (link.href === '/' ? pathname === '/' : true) }
                tooltip={{ children: link.label }}
              >
                <Link href={link.href}>
                  <link.icon />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          {secondaryLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(link.href)}
                tooltip={{ children: link.label }}
              >
                <Link href={link.href}>
                  <link.icon />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
