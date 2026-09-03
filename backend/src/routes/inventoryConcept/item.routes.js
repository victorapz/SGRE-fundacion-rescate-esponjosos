"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createItem,
  deleteItem,
  getItem,
  getItems,
  updateItem,
} from "../../controllers/inventoryConcept/item.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:item:create"), createItem)
  .get("/", checkRbac("inventory:item:read"), getItems)
  .get("/detail/", checkRbac("inventory:item:read"), getItem)
  .patch("/detail/", checkRbac("inventory:item:update"), updateItem)
  .delete("/detail/", checkRbac("inventory:item:delete"), deleteItem);

export default router;
