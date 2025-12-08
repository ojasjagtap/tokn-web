# tokn Landing Page

A modern, startup-style landing page for tokn - the visual flow-based IDE for prompt engineering.

## Overview

This landing page showcases tokn's features and capabilities with a clean, modern design that matches the product's visual identity. The design is inspired by leading AI tools like sim.ai while maintaining tokn's unique dark theme and color palette.

## Design Features

### Color Scheme
- **Primary Background**: `#1a1a1a` - Deep dark theme
- **Accent Blue**: `#4a90e2` - Primary CTA and interactive elements
- **Accent Purple**: `#a78bfa` - Gradient accents
- **Success Green**: `#6f6` - Positive indicators
- **Text Colors**: `#e0e0e0`, `#aaa`, `#888` - Hierarchical text

### Sections

1. **Navigation**
   - Fixed header with blur effect
   - Logo and brand name
   - Links to GitHub and main app

2. **Hero Section**
   - Large, bold headline with gradient text effect
   - Clear value proposition
   - Dual CTAs (Launch App + GitHub)
   - Radial gradient background effect

3. **Visual Demo**
   - Browser window mockup
   - Screenshot of the actual tokn interface
   - Subtle hover effects
   - macOS-style window controls

4. **Features Grid**
   - 6 feature cards highlighting key capabilities
   - Custom icons for each feature
   - Hover effects with elevation and glow
   - Responsive grid layout

5. **Integrations Carousel**
   - Showcases supported AI providers (OpenAI, Claude, Gemini)
   - Auto-scrolling with pause on hover
   - Smooth animations

6. **Use Cases**
   - 4 primary use cases with numbered organization
   - Accent border for visual hierarchy
   - Clean, scannable layout

7. **CTA Section**
   - Final conversion point
   - Emphasizes open source and security
   - Dual CTAs for different user intents

8. **Footer**
   - Brand reinforcement
   - Navigation links
   - Resources and documentation links
   - Copyright information

## Interactive Features

### JavaScript Enhancements

- **Scroll Animations**: Fade-in-up effects on feature cards and use cases
- **Navigation Effects**: Shadow on scroll, smooth anchor linking
- **Carousel Auto-scroll**: Integrations carousel with pause on interaction
- **Parallax Effect**: Subtle parallax on demo window
- **Card Tilt**: 3D tilt effect on feature cards on hover
- **Performance**: Debounced scroll handlers for smooth performance
- **Analytics Ready**: Placeholder tracking for CTA clicks

### Accessibility

- Semantic HTML structure
- Proper heading hierarchy
- Alt text for images
- Keyboard navigation support
- Focus states for interactive elements

## File Structure

```
landing/
├── index.html      # Main landing page
├── styles.css      # All styles with CSS custom properties
├── script.js       # Interactive features and animations
└── README.md       # This file
```

## Local Development

### Using Python HTTP Server

```bash
cd landing
python3 -m http.server 8000
# Visit http://localhost:8000
```

### Using Node.js http-server

```bash
cd landing
npx http-server -p 8000
# Visit http://localhost:8000
```

### Using the Main App (Vite)

The landing page can be accessed through the main app:

```bash
cd ..  # Back to tokn-web root
npm run dev
# Visit http://localhost:3000/landing/
```

## Customization

### Updating Colors

All colors are defined as CSS custom properties in `styles.css`:

```css
:root {
    --bg-primary: #1a1a1a;
    --accent-blue: #4a90e2;
    /* ... other colors */
}
```

### Adding Features

To add a new feature card:

1. Add HTML in the `.features-grid`:
```html
<div class="feature-card">
    <div class="feature-icon"><!-- SVG icon --></div>
    <h3>Feature Title</h3>
    <p>Feature description</p>
</div>
```

2. The card will automatically inherit animations and styles

### Modifying Integrations

Update the integrations in `.integrations-carousel`:

```html
<div class="integration-item">
    <div class="integration-logo">Provider Name</div>
    <p>Description</p>
</div>
```

## Performance

- CSS animations use GPU-accelerated properties
- Intersection Observer for scroll animations
- Debounced scroll handlers
- Lazy loading ready for images
- Optimized for Core Web Vitals

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Responsive Breakpoints

- **Desktop**: > 768px (Full layout)
- **Tablet**: 481px - 768px (Adjusted grid)
- **Mobile**: ≤ 480px (Single column, optimized UI)

## Future Enhancements

- [ ] Dark/light theme toggle
- [ ] Mobile hamburger menu
- [ ] Video demo integration
- [ ] Customer testimonials section
- [ ] Interactive workflow builder demo
- [ ] Blog/changelog integration
- [ ] Newsletter signup
- [ ] A/B testing integration

## License

Follows the same license as the main tokn project (ISC).

## Credits

Design inspired by modern AI tool landing pages including sim.ai, with a focus on clean aesthetics and user experience.
