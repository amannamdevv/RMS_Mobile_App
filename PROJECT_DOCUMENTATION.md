# RMSApp - Project Documentation

## 1. Project Overview
**RMSApp** (Remote Management System App) is a comprehensive mobile application designed for monitoring and managing various types of infrastructure sites (telecom, power, etc.). It provides real-time visibility into site health, asset performance, energy usage, and alarm states.

### Main Features:
- **Site Monitoring**: Real-time status of active and non-active sites.
- **Asset Health Analytics**: Monitoring of batteries, Diesel Generators (DG), rectifiers, and solar panels.
- **Alarm Management**: Live and historical tracking of major, minor, fire, and door alarms.
- **Uptime & SLA Tracking**: Detailed reports on site availability and compliance with Service Level Agreements.
- **Energy Management**: Tracking of run hours for EB (Electricity Board), DG, and Battery Backup.
- **Maintenance Tools**: Specialized tools for field operators to log repairs and equipment statuses.
- **Analytics Dashboard**: High-level summaries for battery health, grid power, and NOC (Network Operation Center) operations.

---

## 2. Tech Stack
- **Framework**: [React Native](https://reactnative.dev/) (v0.84.1)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **State Management**: React Hooks (`useState`, `useEffect`, `useCallback`)
- **Navigation**: [React Navigation](https://reactnavigation.org/) (v7.x)
- **Networking**: [Axios](https://axios-http.com/) for REST API calls
- **Storage**: [`@react-native-async-storage/async-storage`](https://react-native-async-storage.github.io/async-storage/)
- **Charts/Visualization**: `react-native-chart-kit`, `react-native-svg`
- **UI Components**: `react-native-vector-icons`, `react-native-linear-gradient`, `react-native-animatable`
- **Build Tools**: npm, Metro Bundler, Android Studio, Xcode

---

## 3. Project Architecture
The project follows a standard React Native modern functional component structure.

### Folder Structure:
- **`src/`**: Root source folder.
  - **`api/`**: Contains `index.js` which centralizes all backend API calls using Axios.
  - **`assets/`**: Static assets like images and fonts.
  - **`components/`**: Reusable UI components (e.g., `AppHeader`, `Sidebar`, `FilterModal`).
  - **`screens/`**: Organized by module, containing all full-page components.
  - **`types/`**: TypeScript definitions for navigation params and data models.
  - **`utils/`**: Utility functions for alarm processing (`alarmUtils.ts`) and responsive UI scaling (`responsive.ts`).

---

## 4. Module-wise Explanation
The application is divided into several logical modules:

### 4.1 Auth Module
- **SplashScreen**: Initial loading screen with branding.
- **LoginScreen**: Username and password based authentication.
- **OtpScreen**: Two-factor authentication/OTP verification.

### 4.2 Home Module
- **HomeScreen**: High-level dashboard summarizing critical KPIs (Site Status, Offline Sites, Running Status, Alarms, Battery Health).
- **SiteStatusScreen**: Detailed list and status of all monitored sites.
- **SiteDetailsScreen**: Deep-dive into a specific site's metrics (IMEI, site ID, real-time vitals).
- **NonCommSitesScreen**: Tracking of sites that haven't communicated with the server, with aging buckets (0-7 days, 8-30 days, etc.).

### 4.3 Dashboard & Analytics
- **DashboardScreen**: Comprehensive health overview.
- **SiteHealthScreen**: Analysis of site "up" and "down" times.
- **SiteVitalsScreen**: Real-time sensor data from sites (Voltage, Current, Temperature).
- **NocAnalyticsScreen**: Operational metrics for NOC teams.
- **BatteryHealthAnalyticsScreen**: Deep analysis of battery performance and replacement needs.

### 4.4 Maintenance & Tools
- **TTToolScreen**: Troubleshooting tool for equipment and repairs.
- **SiteMaintenanceToolScreen**: Logs for SMPS, DCEM, and Infrastructure maintenance.

### 4.5 Specialized Modules
- **DCEM (DC Energy Meter)**: Analytics and monthly reports for DC power usage.
- **Energy**: Run hour reports for different power sources.
- **Asset Health**: Specific dashboards for Battery, DG, and Solar assets.
- **Uptime**: Complex SLA compliance and repeat outage tracking.

---

## 5. API Details
The app interacts with a Django-based backend at `https://rms.shrotitele.com`.

### Authentication Flow:
1. **Login**: `POST /api/auth/login/` - Returns a `sessionid` cookie.
2. **OTP Verify**: `POST /api/auth/verify-otp/` - Finalizes authentication.
3. **Session Persistence**: The `sessionid` is stored in `AsyncStorage` and attached to ทุก request header via Axios interceptors.

### Key Endpoints:
- `GET /api/status/`: Summary of site counts.
- `GET /api/get-running-status-from-energy-logs/`: Real-time power source status.
- `GET /api/alarms/`: Fetch active alarms (SMPS/RMS).
- `GET /api/uptime-sla/site-wise/`: Site-level availability data.
- `GET /api/battery-health-analytics/`: Aggregated battery health data.

---

## 6. Database Design
This application primarily uses a **Remote Database** accessed via REST APIs. However, it manages local data state as follows:

### Local Storage (`AsyncStorage`):
- **Auth Data**: `djangoSession` (Session ID), `user_id`, `user_fullname`.
- **User Context**: `user_ctmid` (Customer ID) for multi-tenant data filtering.

### Backend Schema (Inferred):
- **Sites**: `id`, `name`, `imei`, `state`, `district`, `cluster`.
- **Assets**: Relationship between sites and equipment (Battery, DG, Rectifier).
- **Alarms**: Timestamped events with severity (Critical, Major, Minor).
- **Logs**: Historical data points for energy consumption and sensor readings.

---

## 7. Important Functionalities
- **Session-Based Authentication**: Secure login with cookie-based session persistence.
- **Multi-Factor Authentication**: OTP verification for sensitive access.
- **Smart Filtering**: Global `FilterModal` component allowing filtering by State, District, Cluster, and Site Type across multiple screens.
- **Real-time KPI Calculations**: Frontend logic in `alarmUtils.ts` to merge SMPS and RMS alarms and calculate severity counts on the fly.
- **Responsive UI**: Custom `responsive.ts` utility ensures the app looks consistent on different screen sizes using `moderateScale` and `responsiveFontSize`.

---

## 8. Code Flow Explanation
1. **User Action**: User opens a screen (e.g., `SiteStatusScreen`).
2. **Data Fetching**: `useEffect` or `useFocusEffect` triggers an API call defined in `src/api/index.js`.
3. **API Interceptor**: Axios interceptor retrieves `sessionid` from `AsyncStorage` and adds it to the request header.
4. **Backend Processing**: Django backend queries the database and returns JSON data.
5. **State Update**: The screen receives the data, updates its local state (`useState`), and the UI re-renders with fresh charts/tables.
6. **Navigation**: User clicks a site to see details; the app navigates to `SiteDetailsScreen` passing the `imei` in `route.params`.

---

## 9. Setup Instructions
### Prerequisites:
- **Node.js**: v22.11.0 or higher (as specified in `package.json`).
- **Java Development Kit (JDK)**: Recommended v17 for Android.
- **Android Studio**: Installed with SDK and Emulator.
- **CocoaPods**: Only for macOS/iOS builds.

### Local Installation:
1. Clone the repository.
2. Install dependencies:
   ```sh
   npm install
   ```
3. **Run Android**:
   ```sh
   npm run android
   ```
4. **Run iOS** (macOS only):
   ```sh
   cd ios && pod install && cd ..
   npm run ios
   ```
5. **Start Metro Server**:
   ```sh
   npm start
   ```

---

## 10. Summary (Managerial Insight)
The **RMSApp** is a robust, scale-ready mobile solution for critical infrastructure management. It leverages a modern React Native architecture to provide real-time operational visibility. By centralizing alarm monitoring, energy tracking, and asset health into a single mobile interface, it enables field operators and managers to make data-driven decisions, reducing downtime and optimizing maintenance costs. The inclusion of SLA tracking and NOC analytics makes it an essential tool for high-availability service providers.
