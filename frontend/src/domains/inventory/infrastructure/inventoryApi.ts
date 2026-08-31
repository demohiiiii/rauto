import {
  deleteInventoryGroup,
  deleteInventoryLabel,
  getInventoryGroup,
  getInventoryLabel,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  saveInventoryGroup,
  saveInventoryLabel,
} from "../../../api/client.js";
import type { InventoryApi } from "../model/types.js";

export const inventoryApi: InventoryApi = {
  deleteGroup: deleteInventoryGroup,
  deleteLabel: deleteInventoryLabel,
  getGroup: getInventoryGroup,
  getLabel: getInventoryLabel,
  listConnections,
  listGroups: listInventoryGroups,
  listLabels: listInventoryLabels,
  saveGroup: saveInventoryGroup,
  saveLabel: saveInventoryLabel,
};
