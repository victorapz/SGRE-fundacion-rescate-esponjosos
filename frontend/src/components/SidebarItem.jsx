import { NavLink } from "react-router-dom";
import {
  CalendarClock,
  HeartHandshake,
  House,
  HousePlus,
  ListTodo,
  Package,
  PawPrint,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

const SIDEBAR_ICONS = {
  home: House,
  animals: PawPrint,
  fosterHome: HousePlus,
  sponsorship: HeartHandshake,
  volunteers: Users,
  shifts: CalendarClock,
  tasks: ListTodo,
  inventory: Package,
  accounting: Wallet,
  settings: Settings,
};

export default function SidebarItem({ item }) {
  const Icon = SIDEBAR_ICONS[item.iconKey] || House;

	return (
		<NavLink
			to={item.path}
			className={({ isActive }) =>
				`menu-item ${isActive ? "menu-item-active" : ""}`.trim()
			}
		>
      <Icon size={20} strokeWidth={2} aria-hidden="true" className="menu-item-icon" />
      <span className="menu-item-label">{item.label}</span>
		</NavLink>
	);
}

