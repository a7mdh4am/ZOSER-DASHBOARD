// The shop's catalog, copied from the shop project (ZOSER: src/data/cards.js,
// keychains.js, pricing.js, extras.js) so the dummy dashboard shows the same
// designs, colors, images and prices. Images are smaller copies of the shop's
// in ./images (cards 360 px wide, keychains 360 px tall).

// Card designs. Each variant is one color: images/cards/<file>_<key>.webp
// (front) and <file>_back_<key>.webp (back).
export const CARD_DESIGNS = [
  {
    id: "starrynight",
    name: "StarryNight",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    variants: [
      {
        file: "vgogh",
        key: "blue",
        name: "Blue",
        hex: "#1F3F8A",
      },
      {
        file: "vgogh",
        key: "pink",
        name: "Pink",
        hex: "#E84D8A",
      },
    ],
  },
  {
    id: "fingerprint",
    name: "FINGERPRINT",
    description: "",
    variants: [
      {
        file: "card",
        key: "green",
        name: "Green",
        hex: "#2E6B2E",
      },
      {
        file: "card",
        key: "brick",
        name: "Brick",
        hex: "#8E3A33",
      },
      {
        file: "card",
        key: "grey",
        name: "Grey",
        hex: "#3A3A3A",
      },
      {
        file: "card",
        key: "navy",
        name: "Navy",
        hex: "#14174A",
      },
      {
        file: "card",
        key: "neon",
        name: "Neon",
        hex: "#4B3FA0",
      },
    ],
  },
  {
    id: "evileye",
    name: "EvilEye",
    description: "",
    variants: [
      {
        file: "eeye",
        key: "blue",
        name: "Blue",
        hex: "#9CC0F0",
      },
      {
        file: "eeye",
        key: "pink",
        name: "Pink",
        hex: "#F4A6BE",
      },
    ],
  },
  {
    id: "graffiti",
    name: "GRAFFITI",
    description: "",
    variants: [
      {
        file: "graffi",
        key: "black",
        name: "Black",
        hex: "#2B2B2B",
      },
      {
        file: "graffi",
        key: "pink",
        name: "Pink",
        hex: "#F4B6C8",
      },
    ],
  },
  {
    id: "lovers",
    name: "LOVERS",
    description: "",
    variants: [
      {
        file: "heart",
        key: "pink",
        name: "Pink",
        hex: "#F28AA0",
      },
      {
        file: "heart",
        key: "skyblue",
        name: "Sky Blue",
        hex: "#8EC5F0",
      },
    ],
  },
  {
    id: "luv",
    name: "LUV",
    description: "",
    variants: [
      {
        file: "luv",
        key: "blue",
        name: "Blue",
        hex: "#6FA8F0",
      },
      {
        file: "luv",
        key: "pink",
        name: "Pink",
        hex: "#F27BA0",
      },
    ],
  },
  {
    id: "memo",
    name: "MEMO",
    description: "",
    variants: [
      {
        file: "memo",
        key: "pink",
        name: "Pink",
        hex: "#F2A0B4",
      },
      {
        file: "memo",
        key: "skyblue",
        name: "Sky Blue",
        hex: "#9CC9F0",
      },
    ],
  },
  {
    id: "passport",
    name: "PASSPORT",
    description: "",
    variants: [
      {
        file: "passport",
        key: "green",
        name: "Green",
        hex: "#5E9E5E",
      },
      {
        file: "passport",
        key: "watermelon",
        name: "Watermelon",
        hex: "#C9474B",
      },
    ],
  },
  {
    id: "pixel",
    name: "PIXEL",
    description: "",
    variants: [
      {
        file: "pixel",
        key: "skyblue",
        name: "Sky Blue",
        hex: "#A9D8F0",
      },
    ],
  },
  {
    id: "seniors",
    name: "SENIORS",
    description: "",
    variants: [
      {
        file: "seniors",
        key: "gold",
        name: "Gold",
        hex: "#F2C66D",
      },
      {
        file: "seniors",
        key: "orange",
        name: "Orange",
        hex: "#F08A4B",
      },
      {
        file: "seniors",
        key: "pink",
        name: "Pink",
        hex: "#F7B8D6",
      },
    ],
  },
  {
    id: "sig",
    name: "Signature",
    description: "",
    variants: [
      {
        file: "sig",
        key: "blue",
        name: "Blue",
        hex: "#4FC3DD",
      },
      {
        file: "sig",
        key: "dark_pink",
        name: "Dark Pink",
        hex: "#E8466A",
      },
      {
        file: "sig",
        key: "yellow",
        name: "Yellow",
        hex: "#F5E83A",
      },
    ],
  },
  {
    id: "snowman",
    name: "SNOWMAN",
    description: "",
    variants: [
      {
        file: "snowman",
        key: "blue",
        name: "Blue",
        hex: "#2A3570",
      },
    ],
  },
  {
    id: "sprk",
    name: "SPRK",
    description: "",
    variants: [
      {
        file: "sprk",
        key: "black",
        name: "Black",
        hex: "#222222",
      },
      {
        file: "sprk",
        key: "peach",
        name: "Peach",
        hex: "#F2A08A",
      },
    ],
  },
  {
    id: "star",
    name: "STAR",
    description: "",
    variants: [
      {
        file: "star",
        key: "yellow",
        name: "Yellow",
        hex: "#FFD93D",
      },
      {
        file: "star",
        key: "brown",
        name: "Brown",
        hex: "#8B5A3C",
      },
      {
        file: "star",
        key: "green",
        name: "Green",
        hex: "#2E9E4E",
      },
      {
        file: "star",
        key: "neonpink",
        name: "Neon Pink",
        hex: "#FF3D8B",
      },
      {
        file: "star",
        key: "purple",
        name: "Purple",
        hex: "#A98BE0",
      },
      {
        file: "star",
        key: "skypink",
        name: "Sky Pink",
        hex: "#F7B8D0",
      },
    ],
  },
  {
    id: "zebra",
    name: "ZEBRA",
    description: "",
    variants: [
      {
        file: "zebra",
        key: "blue",
        name: "Blue",
        hex: "#4A90E8",
      },
      {
        file: "zebra",
        key: "brown",
        name: "Brown",
        hex: "#B8693A",
      },
      {
        file: "zebra",
        key: "pink",
        name: "Pink",
        hex: "#F25C8A",
      },
    ],
  },
];

// Keychains are one product in several designs; each keychain in an order
// picks one. images/keychains/<image>.webp; `tint` is the design's color.
export const KEYCHAIN = {
  id: "keychain",
  name: "Keychain",
  description:
    "A little acrylic keychain with a character on it, that opens your memory page when you tap it on any phone. Order 2 or more and pick a design and a name for each one.",
};
export const KEYCHAIN_DESIGNS = [
  {
    id: "puffer-girl",
    name: "Puffer Girl",
    image: 1,
    tint: "#8C2F4B",
  },
  {
    id: "bunny",
    name: "Bunny",
    image: 2,
    tint: "#EE8AA2",
  },
  {
    id: "watermelon",
    name: "Watermelon",
    image: 3,
    tint: "#E5575F",
  },
  {
    id: "zsr-guy",
    name: "ZSR Guy",
    image: 4,
    tint: "#C2622D",
  },
  {
    id: "hoodie-guy",
    name: "Hoodie Guy",
    image: 5,
    tint: "#2F8A43",
  },
  {
    id: "cool-guy",
    name: "Cool Guy",
    image: 6,
    tint: "#D63A34",
  },
  {
    id: "shy",
    name: "Shy",
    image: 7,
    tint: "#E3B23C",
  },
  {
    id: "red-dress",
    name: "Red Dress",
    image: 8,
    tint: "#D33A3A",
  },
];

// EGP: the sale price per card or keychain. (Shipping isn't copied: the
// dashboard prices it by zone, see CITIES in db.js.)
export const PRICE = 260;

// Add-ons offered in the order steps.
export const EXTRAS = [
  {
    id: "stickers-pack",
    name: "Stickers Pack",
    price: 80,
  },
  {
    id: "star-theme",
    name: "Star Theme",
    price: 30,
  },
  {
    id: "love-theme",
    name: "Love Theme",
    price: 30,
  },
];
