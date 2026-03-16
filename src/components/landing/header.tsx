"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/src/components/ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
    { href: "/", label: "Home" },
    { href: "#what-is", label: "What is DepGuard AI" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#ai-powered", label: "AI-Powered Analysis" },
    { href: "#why", label: "Why DepGuard AI" },
    { href: "#get-started", label: "Get Started Today" },
];

export function Header() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="fixed w-full z-50 bg-white border-b">
            {/* Desktop + mobile top bar */}
            <div className="flex h-14 items-center justify-between px-6">
                {/* Logo */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex w-10 items-center justify-center rounded-lg">
                        <Image
                        src="/DepGuardAI_Logo.png"
                        width={1000}
                        height={1000}
                        alt="DepGuard AI Logo"
                        />
                    </div>
                    <span className="font-semibold text-foreground">DepGuard AI</span>
                </div>
        
                {/* Desktop nav */}
                <nav className="hidden lg:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <Button key={link.href} variant="ghost" size="sm" asChild>
                        <Link
                            href={link.href}
                            className="text-muted-foreground scroll-smooth"
                        >
                            {link.label}
                        </Link>
                        </Button>
                    ))}
                </nav>
        
                {/* Desktop auth buttons */}
                <div className="hidden lg:flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="bg-secondary" asChild>
                        <Link href="/auth/login">Sign in</Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/auth/sign-up">Get started</Link>
                    </Button>
                </div>
        
                {/* Mobile: auth + hamburger */}
                <div className="flex lg:hidden items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Mobile dropdown menu */}
            {menuOpen && (
                <div className="lg:hidden border-t bg-white px-4 py-3 flex flex-col gap-1 shadow-md">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className="text-sm text-muted-foreground hover:text-foreground py-2 px-3 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="pt-2 border-t mt-1 flex gap-2">
                        <Button variant="ghost" size="sm" className="w-full bg-secondary" asChild>
                            <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
                                Sign in
                            </Link>
                        </Button>

                        <Button size="sm" className="w-full" asChild>
                            <Link href="/auth/sign-up" onClick={() => setMenuOpen(false)}>
                                Get started
                            </Link>
                        </Button>
                    </div>
                </div>
            )}
        </header>
    )
}