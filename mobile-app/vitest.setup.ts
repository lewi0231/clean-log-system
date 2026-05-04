import { vi } from "vitest";

(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

const NullIcon = () => null;

vi.mock("@expo/vector-icons", () => ({
  __esModule: true,
  default: NullIcon,
  Ionicons: NullIcon,
  MaterialIcons: NullIcon,
  AntDesign: NullIcon,
  Entypo: NullIcon,
  EvilIcons: NullIcon,
  Feather: NullIcon,
  FontAwesome: NullIcon,
  Fontisto: NullIcon,
  Foundation: NullIcon,
  MaterialCommunityIcons: NullIcon,
  Octicons: NullIcon,
  SimpleLineIcons: NullIcon,
  Zocial: NullIcon,
}));

vi.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: NullIcon,
}));

vi.mock("react-native-date-picker", () => ({
  __esModule: true,
  default: NullIcon,
}));
