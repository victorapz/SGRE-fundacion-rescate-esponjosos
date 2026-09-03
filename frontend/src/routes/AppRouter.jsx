import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/login.page.jsx";
import Inicio from "../pages/home.page";
import SettingsPage from "../pages/settings.page.jsx";
import AnimalsPage from "../pages/animals.page.jsx";
import AnimalDetailPage from "../pages/animal-detail.page.jsx";
import ExamFormPage from "../pages/exam-form.page.jsx";
import FosterHomePage from "../pages/foster-home.page.jsx";
import FosterHomeDetailPage from "../pages/foster-home-detail.jsx";
import HospitalizationFormPage from "../pages/hospitalization-form.page.jsx";
import ProcedureFormPage from "../pages/procedure-form.page.jsx";
import VolunteersPage from "../pages/volunteers.page";
import ShiftPage from "../pages/shift.page.jsx";
import TaskPage from "../pages/task.page.jsx";
import TaskEditorPage from "../pages/task-editor.page.jsx";
import TaskDetailPage from "../pages/task-detail.page.jsx";
import InventoryPage from "../pages/inventory.page.jsx";
import InventoryItemDetailPage from "../pages/inventory-item-detail.page.jsx";
import AccountingPage from "../pages/accounting.page.jsx";
import ProfilePage from "../pages/profile.page.jsx";
import SponsorshipPage from "../pages/sponsorship.page.jsx";
import VetCheckupFormPage from "../pages/vet-checkup-form.page.jsx";
import NoticeDetailPage from "../pages/notice-detail.page.jsx";
import NoticeEditorPage from "../pages/notice-editor.page.jsx";
import DonationPage from "../pages/public/donation.page.jsx";
import DonationSuccessPage from "../pages/public/donation-success.page.jsx";
import DonationCancelPage from "../pages/public/donation-cancel.page.jsx";
import PublicSponsorshipsPage from "../pages/public/sponsorships.page.jsx";
import PublicSponsorshipDetailPage from "../pages/public/sponsorship-detail.page.jsx";
import PublicSponsorshipSuccessPage from "../pages/public/sponsorship-success.page.jsx";
import PublicSponsorshipCancelPage from "../pages/public/sponsorship-cancel.page.jsx";
import PublicHomePage from "../pages/public/public-home.page.jsx";
import PublicNoticesPage from "../pages/public/notices.page.jsx";
import PublicNoticeDetailPage from "../pages/public/notice-detail.page.jsx";
import PublicAccountingReportsPage from "../pages/public/accounting-reports.page.jsx";
import PublicAccountingReportDetailPage from "../pages/public/accounting-report-detail.page.jsx";
import PublicNotFoundPage from "../pages/public/public-not-found.page.jsx";
import PrivateRoute from "./PrivateRoute";
import AppLayout from "../layouts/AppLayout";
import PublicLayout from "../layouts/PublicLayout";
import RoleRoute from "./RoleRoute";
import { PERMISSIONS } from "../config/permissions";
import { APP_ROUTES, PUBLIC_SITE_ROUTES } from "../config/publicSite.config";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={APP_ROUTES.root} element={<LoginPage />} />
        <Route path={APP_ROUTES.login} element={<LoginPage />} />

        <Route element={<PublicLayout variant="immersive" />}>
          <Route path={PUBLIC_SITE_ROUTES.home} element={<PublicHomePage />} />
          <Route path={PUBLIC_SITE_ROUTES.donate} element={<DonationPage />} />
          <Route path={PUBLIC_SITE_ROUTES.donationSuccess} element={<DonationSuccessPage />} />
          <Route
            path={PUBLIC_SITE_ROUTES.donationSuccessAlias}
            element={<DonationSuccessPage />}
          />
          <Route path={PUBLIC_SITE_ROUTES.donationCancel} element={<DonationCancelPage />} />
          <Route
            path={PUBLIC_SITE_ROUTES.donationCancelAlias}
            element={<DonationCancelPage />}
          />
          <Route path={PUBLIC_SITE_ROUTES.sponsorshipList} element={<PublicSponsorshipsPage />} />
          <Route path={PUBLIC_SITE_ROUTES.sponsorshipSuccess} element={<PublicSponsorshipSuccessPage />} />
          <Route path={PUBLIC_SITE_ROUTES.sponsorshipCancel} element={<PublicSponsorshipCancelPage />} />
          <Route path={PUBLIC_SITE_ROUTES.sponsorshipDetail} element={<PublicSponsorshipDetailPage />} />
          <Route path={PUBLIC_SITE_ROUTES.notices} element={<PublicNoticesPage />} />
          <Route
            path={`${PUBLIC_SITE_ROUTES.notices}/:slug`}
            element={<PublicNoticeDetailPage />}
          />
          <Route
            path={PUBLIC_SITE_ROUTES.accountingReports}
            element={<PublicAccountingReportsPage />}
          />
          <Route
            path={`${PUBLIC_SITE_ROUTES.accountingReports}/:id`}
            element={<PublicAccountingReportDetailPage />}
          />
        </Route>

        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route
            path={APP_ROUTES.adminHome}
            element={
              <RoleRoute permissions={[PERMISSIONS.HOME.EVENT_READ, PERMISSIONS.HOME.NOTICE_READ]}>
                <Inicio />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.ANIMAL_READ]}>
                <AnimalsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.ANIMAL_READ]}>
                <AnimalDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/examenes/nuevo"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.EXAM_CREATE]}>
                <ExamFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/examenes/:examId/editar"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.EXAM_UPDATE]}>
                <ExamFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/hospitalizaciones/nueva"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.HOSPITALIZATION_CREATE]}>
                <HospitalizationFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/hospitalizaciones/:hospitalizationId/editar"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.HOSPITALIZATION_UPDATE]}>
                <HospitalizationFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/procedimientos/nuevo"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.PROCEDURE_CREATE]}>
                <ProcedureFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/procedimientos/:procedureId/editar"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.PROCEDURE_UPDATE]}>
                <ProcedureFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/controles/nuevo"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.VET_CHECKUP_CREATE]}>
                <VetCheckupFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/rescatados/:id/controles/:checkupId/editar"
            element={
              <RoleRoute permissions={[PERMISSIONS.ANIMALS.VET_CHECKUP_UPDATE]}>
                <VetCheckupFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/hogar-temporal"
            element={
              <RoleRoute
                permissionPrefixes={["animals:foster_home:", "animals:foster_assignment:"]}
              >
                <FosterHomePage />
              </RoleRoute>
            }
          />
          <Route
            path="/hogar-temporal/:id"
            element={
              <RoleRoute
                permissionPrefixes={["animals:foster_home:", "animals:foster_assignment:"]}
              >
                <FosterHomeDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/voluntarios"
            element={
              <RoleRoute permissions={[PERMISSIONS.USERS.READ, PERMISSIONS.ROLES.READ]}>
                <VolunteersPage />
              </RoleRoute>
            }
          />
          <Route
            path="/turnos"
            element={
              <RoleRoute permissions={[PERMISSIONS.SHIFTS.READ]}>
                <ShiftPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tareas"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.TASKS.READ_ANY,
                PERMISSIONS.TASKS.READ_AREA,
                PERMISSIONS.TASKS.READ_MINE,
              ]}>
                <TaskPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tareas/crear"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.TASKS.CREATE_ANY,
                PERMISSIONS.TASKS.CREATE_AREA,
              ]}>
                <TaskEditorPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tareas/:id/editar"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.TASKS.UPDATE_ANY,
                PERMISSIONS.TASKS.UPDATE_AREA,
              ]}>
                <TaskEditorPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tareas/:id"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.TASKS.READ_ANY,
                PERMISSIONS.TASKS.READ_AREA,
                PERMISSIONS.TASKS.READ_MINE,
              ]}>
                <TaskDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/apadrinamientos"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.ACCOUNTING.SPONSOR_READ,
                PERMISSIONS.ACCOUNTING.SPONSORSHIP_READ,
                PERMISSIONS.ACCOUNTING.SUBSCRIPTION_PAYMENT_READ,
                PERMISSIONS.ACCOUNTING.SPONSORSHIP_PLAN_READ,
              ]}>
                <SponsorshipPage />
              </RoleRoute>
            }
          />
          <Route
            path="/contabilidad"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.ACCOUNTING.DASHBOARD_READ,
                PERMISSIONS.ACCOUNTING.TRANSACTION_READ,
                PERMISSIONS.ACCOUNTING.PAYABLE_READ,
                PERMISSIONS.ACCOUNTING.CATEGORY_READ,
                PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_READ,
                PERMISSIONS.ACCOUNTING.PAYMENT_ORDER_READ,
                PERMISSIONS.ACCOUNTING.WEBHOOK_READ,
                PERMISSIONS.ACCOUNTING.PUBLIC_REPORT_READ,
                PERMISSIONS.ACCOUNTING.DONOR_READ,
              ]}>
                <AccountingPage />
              </RoleRoute>
            }
          />
          <Route
            path="/inventario"
            element={
              <RoleRoute permissionPrefixes={["inventory:"]}>
                <InventoryPage />
              </RoleRoute>
            }
          />
          <Route
            path="/inventario/item/:id"
            element={
              <RoleRoute permissions={[
                PERMISSIONS.INVENTORY.READ_ANY,
                PERMISSIONS.INVENTORY.READ_LOCATION,
                PERMISSIONS.INVENTORY.ITEM_READ,
              ]}>
                <InventoryItemDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/mi-perfil"
            element={<ProfilePage />}
          />
          <Route
            path="/profile"
            element={<Navigate to={APP_ROUTES.myProfile} replace />}
          />
          <Route
            path="/aviso/crear"
            element={
              <RoleRoute permissions={[PERMISSIONS.HOME.NOTICE_CREATE]}>
                <NoticeEditorPage />
              </RoleRoute>
            }
          />
          <Route
            path="/aviso/:id"
            element={
              <RoleRoute permissions={[PERMISSIONS.HOME.NOTICE_READ]}>
                <NoticeDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/aviso/:id/editar"
            element={
              <RoleRoute
                permissions={[PERMISSIONS.HOME.NOTICE_READ, PERMISSIONS.HOME.NOTICE_UPDATE]}
                requireAllPermissions
              >
                <NoticeEditorPage />
              </RoleRoute>
            }
          />
          <Route
            path="/configuracion"
            element={
              <RoleRoute permissions={[PERMISSIONS.SETTINGS.READ]}>
                <SettingsPage />
              </RoleRoute>
            }
          />
        </Route>

        <Route element={<PublicLayout variant="default" />}>
          <Route path="*" element={<PublicNotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
