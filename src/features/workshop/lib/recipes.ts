import type { Item } from "../../../shared/contracts";
export interface Recipe {
  id: string;
  name: string;
  input: Item;
  amount: number;
  output: Item;
  quantity: number;
  duration: number;
  cost: number;
  /** 工具类配方的产品用于开垦，不可出售 */
  tool?: boolean;
}
export const recipes: Recipe[] = [
  {
    id: "jam",
    name: "莓果酱",
    input: "berry",
    amount: 3,
    output: "jam",
    quantity: 2,
    duration: 8,
    cost: 4,
  },
  {
    id: "flour",
    name: "玉米粉",
    input: "corn",
    amount: 4,
    output: "flour",
    quantity: 3,
    duration: 6,
    cost: 3,
  },
  {
    id: "shovel",
    name: "铁锹",
    input: "corn",
    amount: 2,
    output: "shovel",
    quantity: 1,
    duration: 4,
    cost: 8,
    tool: true,
  },
  {
    id: "axe",
    name: "斧子",
    input: "carrot",
    amount: 3,
    output: "axe",
    quantity: 1,
    duration: 6,
    cost: 12,
    tool: true,
  },
  {
    id: "pick",
    name: "镐子",
    input: "corn",
    amount: 4,
    output: "pick",
    quantity: 1,
    duration: 8,
    cost: 16,
    tool: true,
  },
];
export const recipeById = (id: string) => recipes.find((r) => r.id === id);
