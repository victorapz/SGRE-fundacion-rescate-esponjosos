import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import HomeTabs from "../components/home/HomeTabs";
import HomeTabPanel from "../components/home/HomeTabPanel";
import EventsTab from "../components/home/events/EventsTab";
import NoticeTab from "../components/home/notices/NoticeTab";
import { createEvent, deleteEvent, getEvents, updateEvent } from "../services/event.service";
import { deleteNotice, getNotices } from "../services/notice.service";
import { usePermissions } from "../hooks/usePermissions";
import { PERMISSIONS } from "../config/permissions";
import "../styles/home.page.css";
import "../styles/event.page.css";
import "../styles/notice.page.css";

const HOME_TABS = [
  { id: "events", label: "Eventos" },
  { id: "notices", label: "Avisos" },
];

export default function Home() {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState("");
  const [noticeFilters, setNoticeFilters] = useState({
    search: "",
    status: "all",
    visibility: "all",
    order: "desc",
  });

  const availableTabs = useMemo(() => {
    return HOME_TABS.filter((tab) => {
      if (tab.id === "events") {
        return hasAnyPermission([PERMISSIONS.HOME.EVENT_READ]);
      }

      if (tab.id === "notices") {
        return hasAnyPermission([PERMISSIONS.HOME.NOTICE_READ]);
      }

      return true;
    });
  }, [hasAnyPermission]);

  const requestedTab = searchParams.get("tab");
  const activeTab = useMemo(() => {
    if (!availableTabs.length) {
      return "";
    }

    if (requestedTab && availableTabs.some((tab) => tab.id === requestedTab)) {
      return requestedTab;
    }

    return availableTabs[0]?.id || "";
  }, [availableTabs, requestedTab]);

  const canCreateEvent = hasPermission(PERMISSIONS.HOME.EVENT_CREATE);
  const canUpdateEvent = hasPermission(PERMISSIONS.HOME.EVENT_UPDATE);
  const canDeleteEvent = hasPermission(PERMISSIONS.HOME.EVENT_DELETE);

  const canCreateNotice = hasPermission(PERMISSIONS.HOME.NOTICE_CREATE);
  const canUpdateNotice = hasPermission(PERMISSIONS.HOME.NOTICE_UPDATE);
  const canDeleteNotice = hasPermission(PERMISSIONS.HOME.NOTICE_DELETE);

  useEffect(() => {
    if (!availableTabs.length || !activeTab || requestedTab === activeTab) {
      return;
    }

    setSearchParams((currentValue) => {
      const nextValue = new URLSearchParams(currentValue);
      nextValue.set("tab", activeTab);
      return nextValue;
    }, { replace: true });
  }, [activeTab, availableTabs.length, requestedTab, setSearchParams]);

  const handleTabChange = useCallback((nextTab) => {
    if (!nextTab || nextTab === activeTab) {
      return;
    }

    setSearchParams((currentValue) => {
      const nextValue = new URLSearchParams(currentValue);
      nextValue.set("tab", nextTab);
      return nextValue;
    }, { replace: true });
  }, [activeTab, setSearchParams]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setEventsError("");

    try {
      const eventsData = await getEvents();
      setEvents(eventsData);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudieron cargar los eventos";
      setEventsError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadNotices = useCallback(async () => {
    setNoticesLoading(true);
    setNoticesError("");

    try {
      const noticesData = await getNotices();
      setNotices(noticesData);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudieron cargar los avisos";
      setNoticesError(message);
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (activeTab === "notices") {
      loadNotices();
    }
  }, [activeTab, loadNotices]);

  const handleCreateEvent = async (eventData) => {
    try {
      await createEvent(eventData);
      await loadEvents();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudo crear el evento";
      setEventsError(message);
      throw requestError;
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await deleteEvent(eventId);
      setEvents((currentEvents) => currentEvents.filter((eventItem) => String(eventItem.id) !== String(eventId)));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudo eliminar el evento";
      setEventsError(message);
      throw requestError;
    }
  };

  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      const updatedEvent = await updateEvent(eventId, eventData);
      setEvents((currentEvents) =>
        currentEvents.map((eventItem) =>
          String(eventItem.id) === String(eventId) ? updatedEvent : eventItem,
        ),
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudo actualizar el evento";
      setEventsError(message);
      throw requestError;
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    try {
      await deleteNotice(noticeId);
      await loadNotices();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudo eliminar el aviso";
      setNoticesError(message);
      throw requestError;
    }
  };

  return (
    <section className="main-content home-content">
      <header className="main-header">
        <h1>Gestión de calendario y avisos</h1>
        <p>Administra los eventos de la organización y comunicados internos.</p>
      </header>

      <HomeTabs tabs={availableTabs} activeTab={activeTab} onChange={handleTabChange} />

      {availableTabs.length === 0 ? (
        <p className="list-message">No tienes permisos para ver esta seccion.</p>
      ) : (
        <HomeTabPanel id={activeTab}>
          {activeTab === "events" ? (
            <EventsTab
              events={events}
              isLoading={isLoading}
              error={eventsError}
              onRefresh={loadEvents}
              onCreateEvent={handleCreateEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              canCreate={canCreateEvent}
              canUpdate={canUpdateEvent}
              canDelete={canDeleteEvent}
            />
          ) : (
            <NoticeTab
              notices={notices}
              isLoading={noticesLoading}
              error={noticesError}
              filters={noticeFilters}
              onFiltersChange={(changes) =>
                setNoticeFilters((currentValue) => ({
                  ...currentValue,
                  ...changes,
                }))
              }
              onDeleteNotice={handleDeleteNotice}
              canCreate={canCreateNotice}
              canUpdate={canUpdateNotice}
              canDelete={canDeleteNotice}
            />
          )}
        </HomeTabPanel>
      )}
    </section>
  );
}
