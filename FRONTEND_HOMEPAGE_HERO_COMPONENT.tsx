import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
// For web version, use: import './HomepageHeroComponent.css';

/**
 * Homepage Hero Component
 * Matches the exact design from the reference image
 * 
 * Features:
 * - Monochromatic design (black, white, gray)
 * - Navigation bar with logo and links
 * - Hero section with highlighted "design" text
 * - Three feature cards (Subscribe, Receive, Check)
 * - Rounded corners throughout
 * - Clean sans-serif typography
 */

interface HomepageHeroProps {
  onSignUp?: () => void;
  onSignIn?: () => void;
  onOurProject?: () => void;
  onNavItemClick?: (item: string) => void;
}

export const HomepageHeroComponent: React.FC<HomepageHeroProps> = ({
  onSignUp,
  onSignIn,
  onOurProject,
  onNavItemClick,
}) => {
  return (
    <View style={styles.container}>
      {/* Background with geometric shapes */}
      <View style={styles.background}>
        {/* Geometric shapes - can be SVG or images */}
        <View style={styles.geometricShape1} />
        <View style={styles.geometricShape2} />
        <View style={styles.geometricDot1} />
        <View style={styles.geometricDot2} />
        <View style={styles.geometricLine} />
      </View>

      {/* Main content card */}
      <View style={styles.mainCard}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          {/* Left Navigation */}
          <View style={styles.navLeft}>
            <TouchableOpacity onPress={() => onNavItemClick?.('products')}>
              <Text style={styles.navLink}>Products</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onNavItemClick?.('pricing')}>
              <Text style={styles.navLink}>Pricing</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onNavItemClick?.('community')}>
              <Text style={styles.navLink}>Community</Text>
            </TouchableOpacity>
          </View>

          {/* Center Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <View style={styles.logoInner} />
            </View>
          </View>

          {/* Right Navigation */}
          <View style={styles.navRight}>
            <TouchableOpacity onPress={() => onNavItemClick?.('help')}>
              <Text style={styles.navLink}>Help</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSignIn}>
              <Text style={styles.navLink}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signUpButton} onPress={onSignUp}>
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroHeadline}>
            <Text style={styles.heroText}>We didn't reinvent the wheel, just </Text>
            <View style={styles.highlightedTextContainer}>
              <Text style={styles.highlightedText}>design</Text>
              <View style={styles.arrowTail} />
            </View>
          </View>

          <Text style={styles.heroSubheadline}>
            Design as you know it is out the door. Design as you want it just arrived.
          </Text>

          <TouchableOpacity style={styles.ctaButton} onPress={onOurProject}>
            <Text style={styles.ctaButtonText}>Our Project</Text>
            <View style={styles.arrowIcon}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Feature Cards Section */}
        <View style={styles.featureCards}>
          {/* Card 1: Subscribe */}
          <View style={styles.featureCard}>
            <View style={styles.cardIcon}>
              {/* Envelope with X icon */}
              <View style={styles.iconEnvelope}>
                <View style={styles.iconEnvelopeBody} />
                <View style={styles.iconEnvelopeFlap} />
                <View style={styles.iconX} />
              </View>
            </View>
            <Text style={styles.cardTitle}>Subscribe</Text>
            <Text style={styles.cardDescription}>
              Choose a suitable plan & request as many designs as you'd like.
            </Text>
          </View>

          {/* Card 2: Receive */}
          <View style={styles.featureCard}>
            <View style={styles.cardIcon}>
              {/* Clock icon */}
              <View style={styles.iconClock}>
                <View style={styles.iconClockCircle} />
                <View style={styles.iconClockHand} />
              </View>
            </View>
            <Text style={styles.cardTitle}>Receive</Text>
            <Text style={styles.cardDescription}>
              Within a few business days on average, we will get the design done.
            </Text>
          </View>

          {/* Card 3: Check */}
          <View style={styles.featureCard}>
            <View style={styles.cardIcon}>
              {/* Refresh/Loop arrow icon */}
              <View style={styles.iconRefresh}>
                <View style={styles.iconRefreshCircle} />
                <View style={styles.iconRefreshArrow} />
              </View>
            </View>
            <Text style={styles.cardTitle}>Check</Text>
            <Text style={styles.cardDescription}>
              We'll revise the designs until you're 100% satisfied.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5', // Light gray background
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    // Geometric shapes positioned absolutely
  },
  geometricShape1: {
    position: 'absolute',
    left: -50,
    top: '20%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2D2D2D', // Dark gray
    opacity: 0.3,
  },
  geometricShape2: {
    position: 'absolute',
    right: -50,
    top: '60%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2D2D2D',
    opacity: 0.3,
  },
  geometricDot1: {
    position: 'absolute',
    left: '15%',
    top: '40%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D2D2D',
    opacity: 0.5,
  },
  geometricDot2: {
    position: 'absolute',
    right: '20%',
    top: '30%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D2D2D',
    opacity: 0.5,
  },
  geometricLine: {
    position: 'absolute',
    left: '25%',
    top: '50%',
    width: 60,
    height: 2,
    backgroundColor: '#2D2D2D',
    opacity: 0.3,
    transform: [{ rotate: '45deg' }],
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    width: '100%',
    maxWidth: 1200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 60,
    paddingHorizontal: 20,
  },
  navLeft: {
    flexDirection: 'row',
    gap: 32,
  },
  navLink: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '400',
    fontFamily: 'System', // Use system font or sans-serif
  },
  logoContainer: {
    position: 'absolute',
    left: '50%',
    marginLeft: -25,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2D2D2D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  signUpButton: {
    borderWidth: 1,
    borderColor: '#2D2D2D',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  signUpButtonText: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '500',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 80,
  },
  heroHeadline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 60,
  },
  highlightedTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
  },
  highlightedText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arrowTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderLeftColor: '#000000',
    borderTopWidth: 6,
    borderTopColor: 'transparent',
    borderBottomWidth: 6,
    borderBottomColor: 'transparent',
    marginLeft: -1,
  },
  heroSubheadline: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 28,
    maxWidth: 600,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 12,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  arrowIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  featureCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  featureCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  // Envelope icon styles
  iconEnvelope: {
    width: 32,
    height: 24,
    position: 'relative',
  },
  iconEnvelopeBody: {
    width: 32,
    height: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 2,
  },
  iconEnvelopeFlap: {
    width: 32,
    height: 16,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    position: 'absolute',
    top: 0,
    transform: [{ rotate: '180deg' }],
  },
  iconX: {
    width: 16,
    height: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 10,
    left: 8,
    transform: [{ rotate: '45deg' }],
  },
  // Clock icon styles
  iconClock: {
    width: 32,
    height: 32,
    position: 'relative',
  },
  iconClockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  iconClockHand: {
    width: 2,
    height: 10,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 6,
    left: 15,
  },
  // Refresh icon styles
  iconRefresh: {
    width: 32,
    height: 32,
    position: 'relative',
  },
  iconRefreshCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRightColor: 'transparent',
  },
  iconRefreshArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderLeftColor: '#FFFFFF',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    position: 'absolute',
    top: 4,
    right: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default HomepageHeroComponent;







