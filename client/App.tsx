import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

import Index from "./pages/Index";
import VideoPlayer from "./pages/VideoPlayer";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AdminLayout from "./pages/admin/AdminLayout";

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const VideosManagement = lazy(() => import("./pages/admin/Videos"));
const Folders = lazy(() => import("./pages/admin/Folders"));
const Uploads = lazy(() => import("./pages/admin/Uploads"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Webhooks = lazy(() => import("./pages/admin/Webhooks"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const APIDocs = lazy(() => import("./pages/admin/APIDocs"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Health = lazy(() => import("./pages/admin/Health"));
const Logs = lazy(() => import("./pages/admin/Logs"));
const Backup = lazy(() => import("./pages/admin/Backup"));

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/video/:id" element={<VideoPlayer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          
          {/* Admin routes with lazy loading */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route
              index
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="videos"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <VideosManagement />
                </Suspense>
              }
            />
            <Route
              path="folders"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Folders />
                </Suspense>
              }
            />
            <Route
              path="uploads"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Uploads />
                </Suspense>
              }
            />
            <Route
              path="analytics"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Analytics />
                </Suspense>
              }
            />
            <Route
              path="webhooks"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Webhooks />
                </Suspense>
              }
            />
            <Route
              path="reports"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Reports />
                </Suspense>
              }
            />
            <Route
              path="api-docs"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <APIDocs />
                </Suspense>
              }
            />
            <Route
              path="health"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Health />
                </Suspense>
              }
            />
            <Route
              path="logs"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Logs />
                </Suspense>
              }
            />
            <Route
              path="backup"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Backup />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Settings />
                </Suspense>
              }
            />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
