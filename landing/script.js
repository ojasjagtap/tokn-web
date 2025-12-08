/**
 * tokn Landing Page - Interactive Elements
 */

// ============================================================================
// SCROLL ANIMATIONS
// ============================================================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-up');
        }
    });
}, observerOptions);

// Observe all feature cards
document.addEventListener('DOMContentLoaded', () => {
    const featureCards = document.querySelectorAll('.feature-card');
    const useCases = document.querySelectorAll('.use-case');
    const integrations = document.querySelectorAll('.integration-item');

    featureCards.forEach(card => {
        observer.observe(card);
    });

    useCases.forEach(useCase => {
        observer.observe(useCase);
    });

    integrations.forEach(integration => {
        observer.observe(integration);
    });
});

// ============================================================================
// NAVIGATION SCROLL EFFECT
// ============================================================================

let lastScroll = 0;
const nav = document.querySelector('.nav');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // Add shadow on scroll
    if (currentScroll > 50) {
        nav.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.5)';
    } else {
        nav.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});

// ============================================================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        // Skip if href is just "#"
        if (href === '#') return;

        e.preventDefault();

        const target = document.querySelector(href);
        if (target) {
            const navHeight = nav.offsetHeight;
            const targetPosition = target.offsetTop - navHeight - 20;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ============================================================================
// DEMO WINDOW PARALLAX EFFECT
// ============================================================================

const demoWindow = document.querySelector('.demo-window');
if (demoWindow) {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const demoPosition = demoWindow.getBoundingClientRect().top + scrolled;
        const windowHeight = window.innerHeight;

        if (scrolled + windowHeight > demoPosition && scrolled < demoPosition + demoWindow.offsetHeight) {
            const parallaxValue = (scrolled - demoPosition + windowHeight) * 0.05;
            demoWindow.style.transform = `translateY(${parallaxValue}px)`;
        }
    });
}

// ============================================================================
// FEATURE CARD TILT EFFECT (SUBTLE)
// ============================================================================

const cards = document.querySelectorAll('.feature-card');

cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ============================================================================
// PERFORMANCE OPTIMIZATION
// ============================================================================

// Debounce function for scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debouncing to expensive operations
const debouncedScroll = debounce(() => {
    // Additional scroll logic can go here
}, 10);

window.addEventListener('scroll', debouncedScroll);

// ============================================================================
// ANALYTICS (Placeholder)
// ============================================================================

// Track CTA clicks
document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
    button.addEventListener('click', (e) => {
        const buttonText = e.target.textContent;
        const href = e.target.href;

        // Placeholder for analytics
        console.log(`CTA clicked: ${buttonText} -> ${href}`);

        // Example: Send to analytics service
        // analytics.track('CTA Click', { button: buttonText, destination: href });
    });
});

// ============================================================================
// EASTER EGG - KONAMI CODE
// ============================================================================

let konamiCode = [];
const konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiPattern.join(',')) {
        // Easter egg activated!
        document.body.style.animation = 'rainbow 2s infinite';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 5000);
    }
});

// ============================================================================
// MOBILE MENU (IF NEEDED IN FUTURE)
// ============================================================================

// Placeholder for mobile menu toggle
const createMobileMenu = () => {
    // Future implementation for mobile navigation
    console.log('Mobile menu functionality ready for implementation');
};

// Initialize on load
if (window.innerWidth <= 768) {
    createMobileMenu();
}
