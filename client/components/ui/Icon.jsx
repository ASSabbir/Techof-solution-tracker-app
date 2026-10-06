import {
  LuLayoutDashboard, LuListChecks, LuUsers, LuTrophy, LuClock, LuCalendarOff, LuActivity, LuUser, LuSettings,
  LuPlus, LuBell, LuLogOut, LuMenu, LuX, LuCheck, LuCheckCheck, LuChevronLeft, LuChevronRight, LuChevronDown,
  LuSearch, LuFilter, LuTimer, LuHourglass, LuTriangleAlert, LuFlame, LuZap, LuTarget, LuAward, LuMoon, LuSun,
  LuMonitor, LuLock, LuEye, LuEyeOff, LuMail, LuCamera, LuCalendar, LuCalendarDays, LuLogIn, LuArrowRight,
  LuArrowLeft, LuRefreshCw, LuInbox, LuFileText, LuShieldCheck, LuHistory, LuSparkles, LuPanelLeftClose,
  LuPanelLeftOpen, LuBan, LuCircleCheck, LuCircleX, LuCircleAlert, LuRocket, LuLayers, LuMedal, LuCrown,
  LuTrendingUp, LuUserCheck, LuSave, LuSlidersHorizontal, LuPencil,
} from 'react-icons/lu';

export const ICONS = {
  dashboard: LuLayoutDashboard, mine: LuListChecks, team: LuUsers, trophy: LuTrophy, clock: LuClock, leave: LuCalendarOff,
  activity: LuActivity, profile: LuUser, settings: LuSettings, plus: LuPlus, bell: LuBell, logout: LuLogOut, menu: LuMenu,
  close: LuX, check: LuCheck, checks: LuCheckCheck, left: LuChevronLeft, right: LuChevronRight, down: LuChevronDown,
  search: LuSearch, filter: LuFilter, timer: LuTimer, hourglass: LuHourglass, warning: LuTriangleAlert, flame: LuFlame,
  zap: LuZap, target: LuTarget, award: LuAward, moon: LuMoon, sun: LuSun, monitor: LuMonitor, lock: LuLock, eye: LuEye,
  eyeOff: LuEyeOff, mail: LuMail, camera: LuCamera, calendar: LuCalendar, days: LuCalendarDays, login: LuLogIn,
  arrow: LuArrowRight, back: LuArrowLeft, refresh: LuRefreshCw, inbox: LuInbox, file: LuFileText, shield: LuShieldCheck,
  history: LuHistory, sparkles: LuSparkles, collapse: LuPanelLeftClose, expand: LuPanelLeftOpen, ban: LuBan,
  ok: LuCircleCheck, no: LuCircleX, alert: LuCircleAlert, rocket: LuRocket, layers: LuLayers, medal: LuMedal, crown: LuCrown,
  trend: LuTrendingUp, userCheck: LuUserCheck, save: LuSave, sliders: LuSlidersHorizontal, edit: LuPencil,
};

export default function Icon({ name, className = 'h-4 w-4', ...rest }) {
  const Cmp = ICONS[name] || LuCircleAlert;
  return <Cmp className={className} aria-hidden="true" {...rest} />;
}
