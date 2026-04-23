import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowUpFromLine,
  BoxSelect,
  Dog,
  Home,
  Hospital,
  Search,
  Send,
  Star,
  UserCheck,
  WholeWord,
  type LucideIcon,
} from "lucide-react";
import SatisfactionModal from "../SatisfactionModal";
import { useFeedbackSubmission } from "../../hook/useFeedbackSubmission";

interface SidebarUser {
  aud: string;
  role?: string;
}

interface SidebarMenuItem {
  name: string;
  icon: LucideIcon;
  path: string;
  showIf?: (user: SidebarUser) => boolean;
  badge: string | null;
}

interface SidebarProps {
  isOpen: boolean;
  user: SidebarUser;
}

interface SidebarProps {
  isOpen: boolean;
  user: SidebarUser;
  toggleSidebar?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, user, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isSatisfactionModalOpen, setIsSatisfactionModalOpen] = useState(false);
  const { isSubmitting, submitFeedback } = useFeedbackSubmission();

  // Reference `toggleSidebar` to satisfy `noUnusedLocals` when the prop is provided
  // but not used inside this component. This avoids TS6133 during `tsc -b`.
  void toggleSidebar;

  const menuItems: SidebarMenuItem[] = useMemo(
    () => [
      {
        name: "แดชบอร์ด",
        icon: Home,
        path: "/novel/dashboard",
        showIf: (currentUser) =>
          currentUser.aud === "vet" || currentUser.aud === "admin",
        badge: null,
      },
      {
        name: "เพิ่มข้อมูลสัตว์ป่วย",
        icon: Dog,
        path: "/novel/animals",
        showIf: (currentUser) => currentUser.aud === "vet",
        badge: null,
      },
      {
        name: "ส่งตัวสัตว์ป่วย",
        icon: Send,
        path: "/novel/referral",
        showIf: (currentUser) => currentUser.aud === "vet",
        badge: null,
      },
      {
        name: "ตรวจสอบสถานะ",
        icon: Search,
        path: "/novel/status",
        showIf: (currentUser) => currentUser.aud === "vet",
        badge: null,
      },

      {
        name: "เพิ่มสถานที่ทำงาน",
        icon: Home,
        path: "/novel/workplaces",
        showIf: (currentUser) => currentUser.aud === "vet",
        badge: null,
      },

      {
        name: "ข้อมูลผู้ใช้งาน",
        icon: UserCheck,
        path: "/novel/profile",
        showIf: (currentUser) => currentUser.aud === "vet",
        badge: null,
      },

      {
        name: "Case Referral",
        icon: ArrowUpFromLine,
        path: "/novel/case-referral",
        showIf: (currentUser) =>
          currentUser.aud === "admin" &&
          (currentUser.role === "ADMIN" || currentUser.role === "COUNTER"),
        badge: null,
      },
      {
        name: "ภาพรวมการส่งต่อ",
        icon: Hospital,
        path: "/novel/hospitals",
        showIf: (currentUser) =>
          currentUser.aud === "admin" && currentUser.role === "ADMIN",
        badge: null,
      },
      {
        name: "ผลการประเมินความพึงพอใจ",
        icon: WholeWord,
        path: "/novel/feedback-report",
        showIf: (currentUser) =>
          currentUser.aud === "admin" && currentUser.role === "ADMIN",
        badge: null,
      },

      // {
      //   name: "ข้อมูลโรงพยาบาล/คลินิก",
      //   icon: Hospital,
      //   path: "/novel/hospitals-info",
      //   showIf: (currentUser) =>
      //     currentUser.aud === "admin" && currentUser.role === "ADMIN",
      //   badge: null,
      // },
      {
        name: "กำหนดสิทธิ์",
        icon: BoxSelect,
        path: "/novel/permission",
        showIf: (currentUser) =>
          currentUser.aud === "admin" && currentUser.role === "ADMIN",
        badge: null,
      },
    ],
    [],
  );

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => !item.showIf || item.showIf(user)),
    [menuItems, user?.aud, user?.role],
  );

  const isActive = (path: string) => {
    const pathname = location.pathname;
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <>
      <motion.aside
        className="fixed top-0 left-0 z-40 h-full bg-linear-to-b from-slate-900 to-slate-800 shadow-2xl overflow-hidden flex flex-col"
        animate={{ width: isOpen ? "260px" : "80px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Decorative Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Header */}
        <div className="relative p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            {/* Logo Container */}
            <motion.div
              className="relative"
              animate={{
                scale: isOpen ? 1 : 0.9,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />

              {/* Logo */}
              <div className="relative w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="material-symbols-outlined text-white text-xl">
                  local_hospital
                </span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 1 }}
              animate={{
                opacity: isOpen ? 1 : 0,
                x: isOpen ? 0 : -10,
                display: isOpen ? "block" : "none",
              }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-xl font-bold text-white">Referral</h1>
              <p className="text-xs text-blue-300/70 mt-0.5">
                Veterinary System
              </p>
            </motion.div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {visibleMenuItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
                onHoverStart={() => setHoveredItem(item.path)}
                onHoverEnd={() => setHoveredItem(null)}
              >
                {/* Active Indicator */}
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-linear-to-b from-blue-400 to-indigo-400 rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <button
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  aria-label={!isOpen ? item.name : undefined}
                  className={`
                  relative flex items-center w-full px-3 py-2.5 rounded-xl transition-all duration-200
                  ${
                    active
                      ? "bg-linear-to-r from-blue-600/20 to-indigo-600/20 text-white"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }
                `}
                >
                  {/* Icon Container */}
                  <motion.div
                    className="relative"
                    animate={{
                      scale: hoveredItem === item.path ? 1.1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        active ? "text-blue-400" : "text-slate-400"
                      }`}
                    />

                    {/* Icon Glow */}
                    {active && (
                      <div className="absolute inset-0 bg-blue-400/20 blur-md rounded-full" />
                    )}
                  </motion.div>

                  {/* Menu Text */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.span
                        key={`label-${item.path}`}
                        className="ml-3 text-sm font-medium whitespace-nowrap flex-1 text-left"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Badge */}
                  {item.badge && (
                    <AnimatePresence>
                      {isOpen && (
                        <motion.span
                          key={`badge-${item.path}`}
                          className="ml-3 text-xs font-semibold whitespace-nowrap flex-1 text-right"
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 6 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.badge}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  )}
                </button>

                {/* Tooltip */}
                <AnimatePresence>
                  {!isOpen && hoveredItem === item.path && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50"
                    >
                      <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-700 whitespace-nowrap">
                        {item.name}
                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="space-y-3 p-3 border-t border-slate-700/50">
          <motion.button
            type="button"
            onClick={() => setIsSatisfactionModalOpen(true)}
            title="ประเมินความพึงพอใจ"
            aria-label="เปิดแบบประเมินความพึงพอใจ"
            className="group relative w-full overflow-hidden rounded-xl border border-amber-400/25 bg-linear-to-br from-amber-400/15 via-amber-300/10 to-slate-900/70 text-left shadow-lg shadow-amber-950/20 transition-colors hover:border-amber-300/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
            animate={{ padding: isOpen ? "0.875rem" : "0.625rem" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-linear-to-r from-amber-400/0 via-amber-200/10 to-amber-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div
              className={`relative flex items-center ${
                isOpen ? "gap-3" : "justify-center"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isOpen
                    ? "bg-amber-400/15 text-amber-200"
                    : "bg-linear-to-br from-amber-400 to-orange-500 text-slate-950"
                }`}
              >
                <Star className="h-5 w-5" fill="currentColor" />
              </div>

              <motion.div
                animate={{
                  opacity: isOpen ? 1 : 0,
                  x: isOpen ? 0 : -10,
                  display: isOpen ? "block" : "none",
                }}
                transition={{ duration: 0.2 }}
                className="min-w-0 flex-1"
              >
                <p className="text-sm font-semibold text-white">
                  ประเมินความพึงพอใจ
                </p>
                <p className="mt-1 text-xs text-amber-100/75">
                  แชร์ความคิดเห็นเพื่อช่วยปรับปรุงระบบ
                </p>
              </motion.div>
            </div>
          </motion.button>

          {/* Version Widget */}
          <motion.div
            className="relative overflow-hidden bg-linear-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm cursor-pointer hover:border-blue-500/30 transition-colors group"
            animate={{
              padding: isOpen ? "0.75rem" : "0.5rem",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Animated Background */}
            <motion.div
              className="absolute inset-0 bg-linear-to-r from-blue-600/0 via-blue-600/5 to-indigo-600/0"
              animate={{
                x: ["-100%", "200%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            <div className="relative flex items-center justify-between">
              {/* Version Info - Expanded */}
              <motion.div
                animate={{
                  opacity: isOpen ? 1 : 0,
                  x: isOpen ? 0 : -10,
                  display: isOpen ? "block" : "none",
                }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs text-slate-400">เวอร์ชั่นระบบ</p>
                <p className="text-xs font-bold bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  v{__APP_VERSION__}
                </p>
              </motion.div>

              {/* Icon */}
              <motion.div
                className={`
                p-2 rounded-lg flex items-center justify-center
                ${isOpen ? "bg-linear-to-br from-blue-500/20 to-indigo-500/20" : "bg-linear-to-br from-blue-500 to-indigo-500"}
              `}
                animate={{
                  scale: isOpen ? 1 : 1.1,
                  marginLeft: isOpen ? 0 : "auto",
                  marginRight: isOpen ? 0 : "auto",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              ></motion.div>

              {/* Version Badge - Collapsed */}
              <motion.div
                animate={{
                  opacity: isOpen ? 0 : 1,
                  display: isOpen ? "none" : "block",
                }}
                transition={{ duration: 0.2 }}
                className="absolute left-1/2 -translate-x-1/2"
              >
                <p className="text-xs font-bold text-blue-400">
                  v{__APP_VERSION__}
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.aside>

      <SatisfactionModal
        open={isSatisfactionModalOpen}
        onClose={() => setIsSatisfactionModalOpen(false)}
        onSubmit={submitFeedback}
        submitting={isSubmitting}
      />
    </>
  );
};

export default Sidebar;
