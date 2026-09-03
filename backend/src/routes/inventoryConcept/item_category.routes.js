"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createItemCategory,
  deleteItemCategory,
  getItemCategory,
  getItemCategories,
  updateItemCategory,
} from "../../controllers/inventoryConcept/item_category.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("inventory:item_category:create"),
    createItemCategory,
  )
  .get(
    "/",
    checkRbac("inventory:item_category:read"),
    getItemCategories,
  )
  .get(
    "/detail/",
    checkRbac("inventory:item_category:read"),
    getItemCategory,
  )
  .patch(
    "/detail/",
    checkRbac("inventory:item_category:update"),
    updateItemCategory,
  )
  .delete(
    "/detail/",
    checkRbac("inventory:item_category:delete"),
    deleteItemCategory,
  );

export default router;
