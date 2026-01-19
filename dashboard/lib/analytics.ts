// Simple analytics utility for tracking user interactions
// Can be easily integrated with Google Analytics 4, Mixpanel, or other providers

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  category?: string;
  label?: string;
  value?: number;
}

class Analytics {
  private isEnabled: boolean = process.env.NODE_ENV === 'production';

  // Track custom events
  track(event: AnalyticsEvent) {
    if (!this.isEnabled) {
      console.log('Analytics Event:', event);
      return;
    }

    // Here you would integrate with your analytics provider
    // Example: Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event.name, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        custom_parameters: event.properties,
      });
    }

    // Example: Mixpanel
    // if (typeof window !== 'undefined' && (window as any).mixpanel) {
    //   (window as any).mixpanel.track(event.name, event.properties);
    // }

    // For now, just log to console in development
    console.log('Analytics Event:', event);
  }

  // Track page views
  pageView(page: string, properties?: Record<string, any>) {
    this.track({
      name: 'page_view',
      category: 'navigation',
      properties: {
        page,
        ...properties,
      },
    });
  }

  // Track button clicks
  buttonClick(buttonName: string, location: string, properties?: Record<string, any>) {
    this.track({
      name: 'button_click',
      category: 'interaction',
      label: buttonName,
      properties: {
        location,
        ...properties,
      },
    });
  }

  // Track form submissions
  formSubmit(formName: string, properties?: Record<string, any>) {
    this.track({
      name: 'form_submit',
      category: 'conversion',
      label: formName,
      properties,
    });
  }

  // Track CTA clicks (primary conversion events)
  ctaClick(ctaText: string, location: string, destination?: string) {
    this.track({
      name: 'cta_click',
      category: 'conversion',
      label: ctaText,
      properties: {
        location,
        destination,
      },
    });
  }

  // Track scroll depth
  scrollDepth(percentage: number, page: string) {
    this.track({
      name: 'scroll_depth',
      category: 'engagement',
      value: percentage,
      properties: {
        page,
        percentage,
      },
    });
  }

  // Track time spent on page
  timeOnPage(duration: number, page: string) {
    this.track({
      name: 'time_on_page',
      category: 'engagement',
      value: duration,
      properties: {
        page,
        duration_seconds: duration,
      },
    });
  }
}

export const analytics = new Analytics();

// React hook for analytics tracking
export function useAnalytics() {
  return analytics;
}