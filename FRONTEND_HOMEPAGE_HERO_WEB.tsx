import React from 'react';
import './HomepageHeroWeb.css';

/**
 * Homepage Hero Component - Web Version
 * Exact match to the reference design
 * 
 * Usage:
 * <HomepageHeroWeb 
 *   onSignUp={() => console.log('Sign Up')}
 *   onSignIn={() => console.log('Sign In')}
 *   onOurProject={() => console.log('Our Project')}
 * />
 */

interface HomepageHeroWebProps {
  onSignUp?: () => void;
  onSignIn?: () => void;
  onOurProject?: () => void;
  onNavItemClick?: (item: string) => void;
}

export const HomepageHeroWeb: React.FC<HomepageHeroWebProps> = ({
  onSignUp,
  onSignIn,
  onOurProject,
  onNavItemClick,
}) => {
  return (
    <div className="homepage-hero-container">
      {/* Background with geometric shapes */}
      <div className="homepage-hero-background">
        <div className="geometric-shape shape-1" />
        <div className="geometric-shape shape-2" />
        <div className="geometric-dot dot-1" />
        <div className="geometric-dot dot-2" />
        <div className="geometric-line" />
      </div>

      {/* Main content card */}
      <div className="homepage-hero-card">
        {/* Navigation Bar */}
        <nav className="homepage-hero-nav">
          {/* Left Navigation */}
          <div className="nav-left">
            <a 
              href="#" 
              className="nav-link" 
              onClick={(e) => { 
                e.preventDefault(); 
                onNavItemClick?.('products'); 
              }}
            >
              Products
            </a>
            <a 
              href="#" 
              className="nav-link" 
              onClick={(e) => { 
                e.preventDefault(); 
                onNavItemClick?.('pricing'); 
              }}
            >
              Pricing
            </a>
            <a 
              href="#" 
              className="nav-link" 
              onClick={(e) => { 
                e.preventDefault(); 
                onNavItemClick?.('community'); 
              }}
            >
              Community
            </a>
          </div>

          {/* Center Logo */}
          <div className="logo-container">
            <div className="logo">
              <div className="logo-inner" />
            </div>
          </div>

          {/* Right Navigation */}
          <div className="nav-right">
            <a 
              href="#" 
              className="nav-link" 
              onClick={(e) => { 
                e.preventDefault(); 
                onNavItemClick?.('help'); 
              }}
            >
              Help
            </a>
            <a 
              href="#" 
              className="nav-link" 
              onClick={(e) => { 
                e.preventDefault(); 
                onSignIn?.(); 
              }}
            >
              Sign In
            </a>
            <button className="sign-up-button" onClick={onSignUp}>
              Sign Up
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero-section">
          <h1 className="hero-headline">
            We didn't reinvent the wheel, just{' '}
            <span className="highlighted-text">
              design
              <span className="arrow-tail" />
            </span>
          </h1>

          <p className="hero-subheadline">
            Design as you know it is out the door. Design as you want it just arrived.
          </p>

          <button className="cta-button" onClick={onOurProject}>
            Our Project
            <span className="arrow-icon">→</span>
          </button>
        </section>

        {/* Feature Cards Section */}
        <div className="feature-cards">
          {/* Card 1: Subscribe */}
          <div className="feature-card">
            <div className="card-icon icon-envelope">
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="6" width="28" height="16" stroke="white" strokeWidth="2" rx="2" />
                <path d="M2 6L16 14L30 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="12" x2="18" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="18" y1="12" x2="14" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="card-title">Subscribe</h3>
            <p className="card-description">
              Choose a suitable plan & request as many designs as you'd like.
            </p>
          </div>

          {/* Card 2: Receive */}
          <div className="feature-card">
            <div className="card-icon icon-clock">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" />
                <line x1="16" y1="16" x2="16" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="card-title">Receive</h3>
            <p className="card-description">
              Within a few business days on average, we will get the design done.
            </p>
          </div>

          {/* Card 3: Check */}
          <div className="feature-card">
            <div className="card-icon icon-refresh">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M8 10L8 4L14 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M24 22L24 28L18 28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="card-title">Check</h3>
            <p className="card-description">
              We'll revise the designs until you're 100% satisfied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepageHeroWeb;

