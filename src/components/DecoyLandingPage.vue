<template>
  <div class="decoy-container">
    <!-- Top Announcement Bar -->
    <div class="announcement-bar d-flex justify-space-between align-center px-4 py-1 text-caption">
      <div class="d-flex align-center gap-3">
        <span><v-icon icon="mdi-shield-check" size="14" class="text-success mr-1"></v-icon>USDOT #3892014 &amp; MC-89210-B Certified Carrier</span>
        <span class="d-none d-md-inline">•</span>
        <span class="d-none d-md-inline"><v-icon icon="mdi-star" size="14" class="text-warning mr-1"></v-icon>Rated 4.9/5 by 3,400+ Vehicle Owners</span>
      </div>
      <div class="d-flex align-center gap-4">
        <span><v-icon icon="mdi-phone" size="14" class="mr-1"></v-icon>24/7 Dispatch: <strong>1-800-555-APEX</strong></span>
      </div>
    </div>

    <!-- Main Navigation Bar -->
    <v-app-bar flat class="glass-nav px-4" height="74">
      <div class="d-flex align-center">
        <v-avatar color="primary" rounded="lg" size="42" class="mr-3 elevation-2">
          <v-icon icon="mdi-truck-cargo-container" size="26" color="white"></v-icon>
        </v-avatar>
        <div>
          <div class="text-h6 font-weight-black tracking-tight line-height-1">APEX AUTO</div>
          <div class="text-caption text-medium-emphasis letter-spacing-wide">LOGISTICS &amp; TRANSPORT</div>
        </div>
      </div>

      <v-spacer></v-spacer>

      <div class="d-none d-lg-flex align-center gap-6">
        <a href="#services" class="nav-link">Services</a>
        <a href="#calculator" class="nav-link">Quote Calculator</a>
        <a href="#fleet" class="nav-link">Fleet &amp; Equipment</a>
        <a href="#reviews" class="nav-link">Customer Reviews</a>
        <a href="#faq" class="nav-link">FAQ</a>
      </div>

      <v-spacer></v-spacer>

      <div class="d-flex align-center gap-2">
        <v-btn
          variant="outlined"
          color="primary"
          class="text-none font-weight-bold d-none d-sm-flex"
          prepend-icon="mdi-map-marker-path"
          @click="showTrackingDialog = true"
        >
          Track Load
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="text-none font-weight-bold px-5"
          prepend-icon="mdi-calculator"
          href="#calculator"
        >
          Get Free Quote
        </v-btn>
      </div>
    </v-app-bar>

    <!-- Hero Section -->
    <section class="hero-section text-center position-relative overflow-hidden">
      <div class="hero-bg-glow"></div>
      <v-container class="py-16 position-relative" style="z-index: 2;">
        <v-chip color="primary" variant="tonal" size="small" class="mb-4 font-weight-bold text-uppercase px-4">
          <v-icon icon="mdi-shield-airplane" start size="16"></v-icon>
          Nationwide White-Glove Auto Relocation
        </v-chip>
        <h1 class="hero-title text-h3 text-md-h2 font-weight-black mb-4">
          Safe, Insured &amp; Expedited <br />
          <span class="text-gradient">Vehicle Transport Solutions</span>
        </h1>
        <p class="hero-subtitle text-body-1 text-md-h6 text-medium-emphasis mx-auto mb-10" style="max-width: 680px;">
          From rare exotic supercars and classic restorations to daily drivers and commercial fleets. Guaranteed pickup windows with GPS telemetry tracking.
        </p>

        <!-- Quote Calculator Card -->
        <v-card id="calculator" class="glass-panel mx-auto pa-6 rounded-2xl text-left" max-width="960" elevation="24">
          <div class="d-flex align-center justify-space-between mb-4">
            <div class="d-flex align-center gap-2">
              <v-icon icon="mdi-speedometer" color="primary" size="24"></v-icon>
              <h3 class="text-h6 font-weight-bold">Instant Shipping Rate Estimator</h3>
            </div>
            <v-chip size="small" color="success" variant="flat" class="font-weight-medium">Zero Obligation</v-chip>
          </div>

          <v-row dense>
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="quoteForm.originZip"
                label="Pickup ZIP or City"
                placeholder="e.g. 90210"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-map-marker-outline"
                color="primary"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="quoteForm.destZip"
                label="Delivery ZIP or City"
                placeholder="e.g. 33101"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-flag-checkered"
                color="primary"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="quoteForm.vehicleType"
                :items="['Sedan / Coupe', 'SUV / Crossover', 'Pickup Truck', 'Exotic / Sports Car', 'Vintage Classic']"
                label="Vehicle Class"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-car-side"
                color="primary"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="quoteForm.transportType"
                :items="['Open Multi-Carrier ($)', 'Enclosed Climate-Controlled ($$$)']"
                label="Transport Method"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-truck-trailer"
                color="primary"
              ></v-select>
            </v-col>
          </v-row>

          <div class="d-flex flex-wrap align-center justify-space-between mt-2 pt-2 border-t">
            <div class="d-flex align-center text-caption text-medium-emphasis">
              <v-icon icon="mdi-check-decagram" size="16" color="success" class="mr-1"></v-icon>
              Includes $250,000 comprehensive cargo insurance coverage
            </div>
            <v-btn
              color="primary"
              variant="flat"
              size="large"
              class="font-weight-bold px-8 rounded-lg mt-3 mt-sm-0"
              @click="calculateQuote"
            >
              Calculate Quote Now
            </v-btn>
          </div>
        </v-card>
      </v-container>
    </section>

    <!-- Services Grid -->
    <section id="services" class="py-16">
      <v-container>
        <div class="text-center mb-12">
          <h2 class="text-h4 font-weight-bold mb-2">Our Specialized Freight Services</h2>
          <p class="text-medium-emphasis">Engineered for absolute vehicle security from loading ramp to destination.</p>
        </div>

        <v-row>
          <v-col cols="12" md="4" v-for="service in services" :key="service.title">
            <v-card class="service-card glass-panel pa-6 h-100 rounded-xl" elevation="6">
              <v-avatar :color="service.color" variant="tonal" size="56" class="mb-4">
                <v-icon :icon="service.icon" size="30"></v-icon>
              </v-avatar>
              <h3 class="text-h6 font-weight-bold mb-2">{{ service.title }}</h3>
              <p class="text-body-2 text-medium-emphasis mb-4">{{ service.description }}</p>
              <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item v-for="feat in service.features" :key="feat" class="pa-0 min-h-0 text-caption">
                  <template #prepend>
                    <v-icon icon="mdi-check" size="14" color="success" class="mr-2"></v-icon>
                  </template>
                  {{ feat }}
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Why Choose Apex Section -->
    <section id="fleet" class="py-16 bg-surface-variant">
      <v-container>
        <v-row align="center">
          <v-col cols="12" md="6">
            <v-chip color="primary" size="small" class="mb-3 font-weight-bold">EQUIPMENT &amp; LOGISTICS</v-chip>
            <h2 class="text-h4 font-weight-black mb-4">Precision Hydraulics &amp; Air-Ride Suspensions</h2>
            <p class="text-medium-emphasis mb-4">
              We employ state-of-the-art enclosed carriers equipped with low-angle hydraulic lift gates, soft-tie nylon wheel straps, and satellite GPS monitoring.
            </p>
            <div class="d-flex flex-column gap-3 mb-6">
              <div class="d-flex align-start gap-3">
                <v-icon icon="mdi-shield-lock" color="primary" class="mt-1"></v-icon>
                <div>
                  <strong>Weatherproof Sealed Enclosures</strong>
                  <div class="text-caption text-medium-emphasis">Shielded from salt, road debris, hail, and harsh weather.</div>
                </div>
              </div>
              <div class="d-flex align-start gap-3">
                <v-icon icon="mdi-map-marker-radius" color="primary" class="mt-1"></v-icon>
                <div>
                  <strong>Real-Time Telemetry Tracking</strong>
                  <div class="text-caption text-medium-emphasis">Live location updates and direct communication with transport driver.</div>
                </div>
              </div>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <v-card class="glass-panel pa-8 rounded-2xl text-center">
              <v-icon icon="mdi-truck-fast-outline" size="72" color="primary" class="mb-4"></v-icon>
              <div class="text-h3 font-weight-black text-primary mb-1">99.8%</div>
              <div class="text-subtitle-1 font-weight-bold mb-4">On-Time Delivery Performance</div>
              <p class="text-caption text-medium-emphasis mb-6">
                Over 12,000 routes mapped annually across all 48 continental states and cross-border Canadian routes.
              </p>
              <div class="d-flex justify-center gap-4">
                <v-chip size="small" variant="tonal" color="info">24hr Express Available</v-chip>
                <v-chip size="small" variant="tonal" color="success">Direct Dispatch</v-chip>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Customer Reviews -->
    <section id="reviews" class="py-16">
      <v-container>
        <div class="text-center mb-12">
          <h2 class="text-h4 font-weight-bold mb-2">Verified Shipper Feedback</h2>
          <p class="text-medium-emphasis">Trusted by private collectors, car dealerships, and national rally teams.</p>
        </div>

        <v-row>
          <v-col cols="12" md="4" v-for="review in reviews" :key="review.author">
            <v-card class="glass-panel pa-6 h-100 rounded-xl">
              <div class="d-flex align-center gap-1 mb-3">
                <v-icon v-for="n in 5" :key="n" icon="mdi-star" size="18" color="amber"></v-icon>
              </div>
              <p class="text-body-2 font-italic mb-4">"{{ review.text }}"</p>
              <div class="d-flex align-center gap-3">
                <v-avatar color="primary" size="36">
                  <span class="text-caption font-weight-bold">{{ review.initials }}</span>
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-bold">{{ review.author }}</div>
                  <div class="text-caption text-medium-emphasis">{{ review.vehicle }} • {{ review.route }}</div>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Professional Footer containing the Stealth Trigger -->
    <footer class="footer-section py-12 border-t">
      <v-container>
        <v-row>
          <v-col cols="12" md="4">
            <div class="d-flex align-center mb-3">
              <v-icon icon="mdi-truck-cargo-container" color="primary" class="mr-2"></v-icon>
              <span class="text-h6 font-weight-bold">APEX AUTO LOGISTICS</span>
            </div>
            <p class="text-caption text-medium-emphasis mb-4">
              Nationwide DOT-registered carrier and bonded freight brokerage providing secure automobile logistics, multi-car fleet shipping, and exotic vehicle carrier services.
            </p>
            <div class="text-caption text-medium-emphasis">
              USDOT #3892014 • ICC-MC #89210 • Bonded &amp; Insured
            </div>
          </v-col>

          <v-col cols="6" md="2">
            <div class="text-subtitle-2 font-weight-bold mb-3">Services</div>
            <ul class="footer-links">
              <li><a href="#services">Enclosed Shipping</a></li>
              <li><a href="#services">Open Transport</a></li>
              <li><a href="#services">Exotic Relocation</a></li>
              <li><a href="#services">Dealer Logistics</a></li>
            </ul>
          </v-col>

          <v-col cols="6" md="2">
            <div class="text-subtitle-2 font-weight-bold mb-3">Company</div>
            <ul class="footer-links">
              <li><a href="#fleet">Our Fleet</a></li>
              <li><a href="#reviews">Testimonials</a></li>
              <li><a href="#faq">Insurance Policy</a></li>
              <li><a href="#faq">Claims Process</a></li>
            </ul>
          </v-col>

          <v-col cols="12" md="4">
            <div class="text-subtitle-2 font-weight-bold mb-3">Service Protection &amp; Escrow</div>
            <p class="text-caption text-medium-emphasis mb-3">
              All vehicle consignments are handled under strict compliance with FMCSA safety regulations. Shipments include comprehensive carrier liability and zero-deductible coverage.
            </p>
            
            <!-- THE CRITICAL STEALTH TRIGGER PARAGRAPH -->
            <div class="stealth-clause-box pa-3 rounded-lg text-caption text-medium-emphasis">
              <v-icon icon="mdi-shield-check-outline" size="14" class="text-success mr-1"></v-icon>
              All shipments are safeguarded by our comprehensive damage-free
              <!-- Dynamic Secret Word Trigger -->
              <span
                class="stealth-trigger-word font-weight-medium"
                @click="onTriggerClick"
                title=""
              >{{ triggerDisplayWord }}</span>
              pledge and bonded escrow protection.
            </div>
          </v-col>
        </v-row>

        <v-divider class="my-8 opacity-10"></v-divider>

        <div class="d-flex flex-wrap justify-space-between align-center text-caption text-medium-emphasis">
          <div>&copy; 2026 Apex Auto Logistics LLC. All rights reserved.</div>
          <div class="d-flex gap-4">
            <a href="#" class="nav-link">Privacy Policy</a>
            <a href="#" class="nav-link">Terms of Service</a>
            <a href="#" class="nav-link">FMCSA Licensing</a>
          </div>
        </div>
      </v-container>
    </footer>

    <!-- Dummy Tracking Dialog -->
    <v-dialog v-model="showTrackingDialog" max-width="480">
      <v-card class="glass-panel pa-4 rounded-xl">
        <v-card-title class="font-weight-bold">Live Cargo Tracking</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="trackingId"
            label="Bill of Lading / Tracking ID"
            placeholder="e.g. APX-8921-X"
            variant="outlined"
            density="comfortable"
          ></v-text-field>
          <v-btn
            color="primary"
            block
            variant="flat"
            class="font-weight-bold"
            @click="simulateTrack"
          >
            Locate Shipment
          </v-btn>
          <div v-if="trackingResult" class="mt-4 pa-3 bg-surface-variant rounded-lg text-caption">
            {{ trackingResult }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showTrackingDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Quote Result Dialog -->
    <v-dialog v-model="showQuoteResult" max-width="440">
      <v-card class="glass-panel pa-4 rounded-xl text-center">
        <v-avatar color="success" size="56" class="mx-auto my-3">
          <v-icon icon="mdi-check" size="32" color="white"></v-icon>
        </v-avatar>
        <v-card-title class="font-weight-bold">Estimated Shipping Rate</v-card-title>
        <v-card-text>
          <div class="text-h4 font-weight-black text-primary my-2">{{ calculatedPrice }}</div>
          <p class="text-caption text-medium-emphasis">
            Estimated transit: 3-5 business days. Includes door-to-door carrier pickup and full cargo insurance.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-btn block color="primary" variant="flat" @click="showQuoteResult = false">Book Carrier Slot</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()

const quoteForm = ref({
  originZip: '90210',
  destZip: '33101',
  vehicleType: 'Exotic / Sports Car',
  transportType: 'Enclosed Climate-Controlled ($$$)'
})

const showTrackingDialog = ref(false)
const trackingId = ref('')
const trackingResult = ref('')
const showQuoteResult = ref(false)
const calculatedPrice = ref('$1,280 - $1,450')

const triggerDisplayWord = computed(() => store.triggerWord || 'guarantee')

function onTriggerClick() {
  store.authModalOpen = true
}

function calculateQuote() {
  const isEnclosed = quoteForm.value.transportType.includes('Enclosed')
  calculatedPrice.value = isEnclosed ? '$1,420 - $1,650' : '$890 - $1,050'
  showQuoteResult.value = true
}

function simulateTrack() {
  if (!trackingId.value) return
  trackingResult.value = `Load #${trackingId.value.toUpperCase()}: In transit via I-40 East. Carrier: Unit #104. Scheduled destination arrival in 18 hours.`
}

const services = [
  {
    title: 'Enclosed Vehicle Transport',
    description: 'Premier choice for exotic sports cars, classic restorations, and high-value prototypes.',
    color: 'primary',
    icon: 'mdi-shield-car',
    features: ['Hydraulic horizontal lift-gate', '100% weather & debris sealed', 'Nylon soft-strap wheel tie-downs']
  },
  {
    title: 'Open Multi-Car Carrier',
    description: 'Cost-effective, reliable nationwide shipping for personal vehicles and family relocations.',
    color: 'info',
    icon: 'mdi-truck-trailer',
    features: ['High-frequency weekly departures', 'Direct terminal or door-to-door', 'Fast transit turnaround times']
  },
  {
    title: 'Priority & Expedited Hauling',
    description: 'Guaranteed 24-48hr hot-shot pickup for time-sensitive deliveries, auctions, and track days.',
    color: 'accent',
    icon: 'mdi-lightning-bolt',
    features: ['Dedicated single or tandem rig', 'Continuous twin-driver dispatch', 'Real-time satellite GPS link']
  }
]

const reviews = [
  {
    author: 'Julian M.',
    initials: 'JM',
    vehicle: '1973 Porsche 911 RS',
    route: 'Los Angeles to Miami',
    text: 'Apex handled my vintage air-cooled Porsche with white-glove respect. The driver took detailed photographic inspection before loading on the lift.'
  },
  {
    author: 'Elena R.',
    initials: 'ER',
    vehicle: 'Tesla Model S Plaid',
    route: 'Seattle to Austin',
    text: 'Delivered in under 3 days without a spec of dust. The quote calculator was accurate to the dollar with zero hidden dispatch surcharges.'
  },
  {
    author: 'Marcus Vance',
    initials: 'MV',
    vehicle: 'Ferrari 488 Pista',
    route: 'Scottsdale to Chicago',
    text: 'Enclosed carrier service was flawless. The driver communicated at every state line crossing. Will use for all future track events.'
  }
]
</script>

<style scoped>
.decoy-container {
  min-height: 100vh;
  background-color: #070b14;
  color: #f1f5f9;
}

.announcement-bar {
  background-color: #0b1120;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

.hero-section {
  padding-top: 40px;
  padding-bottom: 60px;
}

.hero-bg-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 600px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 70%);
  pointer-events: none;
}

.text-gradient {
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-link {
  color: #94a3b8;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: #60a5fa;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links li {
  margin-bottom: 8px;
}

.footer-links a {
  color: #94a3b8;
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-links a:hover {
  color: #3b82f6;
}

.stealth-clause-box {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.stealth-trigger-word {
  color: #cbd5e1;
  text-decoration: none;
}

.stealth-trigger-word:hover {
  color: #60a5fa;
}
</style>
