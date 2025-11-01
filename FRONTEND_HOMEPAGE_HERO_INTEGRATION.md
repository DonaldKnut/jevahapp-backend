# Homepage Hero Component Integration Guide

## 📱 **Component Files Created**

1. **`FRONTEND_HOMEPAGE_HERO_COMPONENT.tsx`** - React Native version
2. **`FRONTEND_HOMEPAGE_HERO_WEB.tsx`** - React Web version  
3. **`HomepageHeroWeb.css`** - CSS styles for web version

---

## 🎨 **Design Specifications**

This component matches the reference design exactly:

### **Color Palette**
- **White**: `#FFFFFF` - Main card background, button text, icons
- **Black**: `#000000` - Headlines, highlighted text, icons background
- **Dark Gray**: `#2D2D2D` - Navigation links, logo
- **Medium Gray**: `#1A1A1A` - Button backgrounds, titles
- **Light Gray**: `#F5F5F5` - Page background, feature card backgrounds
- **Text Gray**: `#666666` - Subheadlines, descriptions

### **Typography**
- **Font Family**: System sans-serif (Helvetica, Arial, etc.)
- **Headline**: 48px, Bold (700)
- **Subheadline**: 18px, Regular (400)
- **Navigation**: 16px, Regular (400)
- **Card Titles**: 24px, Bold (700)
- **Card Descriptions**: 16px, Regular (400)

### **Spacing & Layout**
- **Border Radius**: 24px (main card), 16px (feature cards), 12px (buttons/icons), 8px (sign up button)
- **Card Padding**: 60-80px (web), 40px (mobile)
- **Card Gap**: 24px between feature cards
- **Shadow**: Subtle elevation with `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1)`

---

## 🚀 **Usage Examples**

### **React Native (Expo/React Native)**

```tsx
import { HomepageHeroComponent } from './FRONTEND_HOMEPAGE_HERO_COMPONENT';

function HomeScreen() {
  return (
    <HomepageHeroComponent
      onSignUp={() => navigation.navigate('SignUp')}
      onSignIn={() => navigation.navigate('SignIn')}
      onOurProject={() => navigation.navigate('Projects')}
      onNavItemClick={(item) => console.log('Navigate to:', item)}
    />
  );
}
```

### **React Web**

```tsx
import { HomepageHeroWeb } from './FRONTEND_HOMEPAGE_HERO_WEB';
import './HomepageHeroWeb.css';

function HomePage() {
  return (
    <HomepageHeroWeb
      onSignUp={() => router.push('/signup')}
      onSignIn={() => router.push('/signin')}
      onOurProject={() => router.push('/projects')}
      onNavItemClick={(item) => router.push(`/${item}`)}
    />
  );
}
```

---

## 📋 **Component Props**

```typescript
interface HomepageHeroProps {
  onSignUp?: () => void;        // Called when "Sign Up" button is clicked
  onSignIn?: () => void;        // Called when "Sign In" link is clicked
  onOurProject?: () => void;    // Called when "Our Project" button is clicked
  onNavItemClick?: (item: string) => void;  // Called when nav items clicked
  // item can be: 'products' | 'pricing' | 'community' | 'help'
}
```

---

## 🎯 **Key Features**

### **1. Navigation Bar**
- Left: Products, Pricing, Community links
- Center: Circular logo with 'O' design
- Right: Help, Sign In links + Sign Up button

### **2. Hero Section**
- Main headline: "We didn't reinvent the wheel, just **design**"
- "design" word highlighted in black box with arrow tail
- Subheadline with gray text
- "Our Project" CTA button with arrow icon

### **3. Feature Cards**
- Three cards in a row (responsive: stacks on mobile)
- Each card has:
  - Black rounded icon box
  - White icon inside
  - Title in bold
  - Description text

### **4. Background Elements**
- Geometric shapes (partial 'C' letters, dots, lines)
- Subtle opacity for depth

---

## 🎨 **Customization Options**

### **Change Colors**

**In React Native (styles.tsx):**
```typescript
const styles = {
  container: {
    backgroundColor: '#F5F5F5', // Change background
  },
  mainCard: {
    backgroundColor: '#FFFFFF', // Change card color
  },
  // etc...
};
```

**In CSS (HomepageHeroWeb.css):**
```css
.homepage-hero-container {
  background-color: #F5F5F5; /* Change background */
}

.homepage-hero-card {
  background-color: #FFFFFF; /* Change card color */
}
```

### **Change Text Content**

Edit the component file and update:
- Hero headline text
- Subheadline text
- Card titles and descriptions
- Navigation links

### **Change Icons**

Replace SVG icons in the web version or update the icon components in React Native version.

---

## 📱 **Responsive Behavior**

### **Desktop (> 768px)**
- Three feature cards in a row
- Full navigation bar visible
- Large headline (48px)

### **Tablet (≤ 768px)**
- Cards stack vertically
- Navigation may wrap
- Medium headline (32px)

### **Mobile (≤ 480px)**
- Single column layout
- Smaller text sizes
- Compact spacing

---

## ✅ **Integration Checklist**

- [ ] Copy component file to your frontend project
- [ ] Copy CSS file (for web version)
- [ ] Install any required dependencies
- [ ] Update import paths
- [ ] Add navigation handlers
- [ ] Test on different screen sizes
- [ ] Customize colors/content if needed
- [ ] Add to homepage route

---

## 🔗 **Component Structure**

```
HomepageHeroComponent
├── Background (geometric shapes)
├── Main Card
│   ├── Navigation Bar
│   │   ├── Left Nav (Products, Pricing, Community)
│   │   ├── Logo (center)
│   │   └── Right Nav (Help, Sign In, Sign Up)
│   ├── Hero Section
│   │   ├── Headline with highlighted "design"
│   │   ├── Subheadline
│   │   └── CTA Button
│   └── Feature Cards
│       ├── Subscribe Card
│       ├── Receive Card
│       └── Check Card
```

---

## 🎯 **Next Steps**

1. **Copy files** to your frontend project
2. **Import component** in your homepage/landing page
3. **Add navigation handlers** to route users
4. **Customize content** (text, icons, colors if needed)
5. **Test responsiveness** on different devices

---

## 📝 **Notes**

- Component is fully self-contained
- No external dependencies required (uses built-in React components)
- CSS uses standard properties (no special libraries)
- React Native version uses StyleSheet (standard React Native)
- Icons are simple SVG/View components (can be replaced with icon libraries)

---

## ✅ **Ready to Use!**

The component matches the design exactly and is ready to be integrated into your homepage! 🚀

