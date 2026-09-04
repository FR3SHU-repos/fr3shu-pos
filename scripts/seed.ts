/**
 * Development seed for FR3SHU Organic POS.
 *   npm run seed
 *
 * Drops the target database (dev only) and recreates a coherent demo tenant:
 * 1 platform admin, 1 Brand + 1 FPO + 1 Farmer org, 2 locations, 2 registers,
 * seller users, categories, certifications (valid / expiring / pending),
 * organic products sold by weight / volume / bunch / pack, multiple lots with
 * different expiry dates, opening inventory, and one demo sale.
 *
 * Credentials come from SEED_* env vars, or are generated and printed here.
 * Never hard-codes production credentials.
 */
import dotenv from "dotenv";
import mongoose, { type HydratedDocument, type Model } from "mongoose";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { IProduct } from "../shared/interfaces/mongodb/catalog/product";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fall back to .env

import UserModel from "../shared/models/mongodb/identity/user";
import SellerOrganizationModel from "../shared/models/mongodb/identity/sellerOrganization";
import LocationModel from "../shared/models/mongodb/identity/location";
import CategoryModel from "../shared/models/mongodb/catalog/category";
import CertificationModel from "../shared/models/mongodb/catalog/certification";
import ProductModel from "../shared/models/mongodb/catalog/product";
import ProductPriceModel from "../shared/models/mongodb/catalog/productPrice";
import LotModel from "../shared/models/mongodb/inventory/lot";
import InventoryBalanceModel from "../shared/models/mongodb/inventory/inventoryBalance";
import StockMovementModel from "../shared/models/mongodb/inventory/stockMovement";
import PosRegisterModel from "../shared/models/mongodb/pos/posRegister";
import PosSessionModel from "../shared/models/mongodb/pos/posSession";
import { createSale } from "../shared/services/sales";
import type { PosTokenPayload } from "../shared/lib/auth";
import { EMPTY_TOTALS } from "../shared/services/registers";

const uri = process.env.MONGODB_URI?.trim().replace(/^["']|["']$/g, "") ?? "";
if (!uri || uri.includes("<user>") || uri.includes("<cluster>")) {
  console.error("Set MONGODB_URI in .env.local before seeding.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed with NODE_ENV=production.");
  process.exit(1);
}

const genPassword = () => randomBytes(9).toString("base64url");
const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
const hash = (p: string) => bcrypt.hash(p, rounds);
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  await mongoose.connect(uri);
  console.log("Connected:", mongoose.connection.name);

  // Clear this app's collections (a managed Atlas user cannot dropDatabase).
  const { default: SaleModel } = await import("../shared/models/mongodb/pos/sale");
  const { default: PaymentModel } = await import("../shared/models/mongodb/pos/payment");
  const { default: AuditLogModel } = await import("../shared/models/mongodb/audit/auditLog");
  const clearables: Model<unknown>[] = [
    UserModel,
    SellerOrganizationModel,
    LocationModel,
    CategoryModel,
    CertificationModel,
    ProductModel,
    ProductPriceModel,
    LotModel,
    InventoryBalanceModel,
    StockMovementModel,
    PosRegisterModel,
    PosSessionModel,
    SaleModel,
    PaymentModel,
    AuditLogModel,
  ] as unknown as Model<unknown>[];
  await Promise.all(clearables.map((m) => m.deleteMany({})));
  console.log("Cleared existing POS collections.");

  // ── Credentials ──────────────────────────────────────────────────────────
  const creds = {
    admin: {
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@fr3shu.local",
      password: process.env.SEED_ADMIN_PASSWORD ?? genPassword(),
    },
    owner: {
      email: process.env.SEED_OWNER_EMAIL ?? "owner@greenharvest.local",
      password: process.env.SEED_OWNER_PASSWORD ?? genPassword(),
    },
    manager: { email: "manager@greenharvest.local", password: genPassword() },
    cashier: {
      email: process.env.SEED_CASHIER_EMAIL ?? "cashier@greenharvest.local",
      password: process.env.SEED_CASHIER_PASSWORD ?? genPassword(),
    },
    inventory: { email: "inventory@greenharvest.local", password: genPassword() },
  };

  // ── Organisations ───────────────────────────────────────────────────────
  const brand = await SellerOrganizationModel.create({
    name: "Green Harvest Organics",
    type: "Brand",
    status: "Approved",
    legalName: "Green Harvest Organics Pvt Ltd",
    gstin: "37ABCDE1234F1Z5",
    contactEmail: "hello@greenharvest.local",
    contactPhone: "+91 98480 00000",
    settlement: { upiId: "greenharvest@upi" },
    verifiedAt: new Date(),
  });
  const fpo = await SellerOrganizationModel.create({
    name: "Araku Valley Organic FPO",
    type: "FPO",
    status: "Approved",
    verifiedAt: new Date(),
  });
  const farmer = await SellerOrganizationModel.create({
    name: "Ravi Kumar Organic Farm",
    type: "Farmer",
    status: "Approved",
    verifiedAt: new Date(),
  });

  // ── Locations & registers ───────────────────────────────────────────────
  const loc1 = await LocationModel.create({
    orgId: String(brand._id),
    name: "GH Beach Road Outlet",
    code: "GHBR1",
    status: "active",
    address: { line1: "Beach Road", city: "Visakhapatnam", state: "Andhra Pradesh", postalCode: "530002" },
    gstin: brand.gstin,
  });
  const loc2 = await LocationModel.create({
    orgId: String(brand._id),
    name: "GH MVP Colony",
    code: "GHMVP",
    status: "active",
    address: { line1: "Sector 7, MVP Colony", city: "Visakhapatnam", state: "Andhra Pradesh", postalCode: "530017" },
  });

  const reg1 = await PosRegisterModel.create({
    orgId: String(brand._id),
    locationId: String(loc1._id),
    name: "Counter 1",
    code: "C1",
    status: "active",
  });
  await PosRegisterModel.create({
    orgId: String(brand._id),
    locationId: String(loc2._id),
    name: "Counter 2",
    code: "C2",
    status: "active",
  });

  // ── Users ───────────────────────────────────────────────────────────────
  await UserModel.create({
    name: "Platform Admin",
    email: creds.admin.email,
    passwordHash: await hash(creds.admin.password),
    role: "Admin",
    orgId: "",
    isActive: true,
  });
  await UserModel.create({
    name: "Priya Owner",
    email: creds.owner.email,
    passwordHash: await hash(creds.owner.password),
    role: "Owner",
    orgId: String(brand._id),
    locationIds: [String(loc1._id), String(loc2._id)],
    isActive: true,
  });
  await UserModel.create({
    name: "Manoj Manager",
    email: creds.manager.email,
    passwordHash: await hash(creds.manager.password),
    role: "Manager",
    orgId: String(brand._id),
    locationIds: [String(loc1._id)],
    isActive: true,
  });
  const cashierUser = await UserModel.create({
    name: "Chandra Cashier",
    email: creds.cashier.email,
    passwordHash: await hash(creds.cashier.password),
    role: "Cashier",
    orgId: String(brand._id),
    locationIds: [String(loc1._id)],
    isActive: true,
  });
  await UserModel.create({
    name: "Ishaan Inventory",
    email: creds.inventory.email,
    passwordHash: await hash(creds.inventory.password),
    role: "InventoryManager",
    orgId: String(brand._id),
    locationIds: [String(loc1._id)],
    isActive: true,
  });

  // ── Categories ──────────────────────────────────────────────────────────
  const cat = async (name: string, sortOrder: number) =>
    CategoryModel.create({
      orgId: String(brand._id),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      sortOrder,
      isActive: true,
    });
  const [veg, fruit, grains, dairy] = await Promise.all([
    cat("Vegetables", 1),
    cat("Fruits", 2),
    cat("Grains & Pulses", 3),
    cat("Dairy", 4),
  ]);

  // ── Certifications ──────────────────────────────────────────────────────
  const npop = await CertificationModel.create({
    orgId: String(brand._id),
    scheme: "NPOP",
    verificationStatus: "Approved",
    certificateNumber: "NPOP/2025/AP/00412",
    certifyingBody: "APEDA-accredited CB",
    scope: "Vegetables, Fruits, Grains",
    coveredCategories: ["Vegetables", "Fruits", "Grains & Pulses"],
    issueDate: days(-300),
    validFrom: days(-300),
    validUntil: days(300),
    verifiedAt: days(-280),
    verifierNotes: "Documents verified against APEDA registry.",
  });
  const pgsExpiring = await CertificationModel.create({
    orgId: String(brand._id),
    scheme: "PGSIndia",
    verificationStatus: "Approved",
    certificateNumber: "PGS-IN/AP/VZG/1183",
    certifyingBody: "PGS-India Regional Council",
    scope: "Dairy",
    coveredCategories: ["Dairy"],
    issueDate: days(-350),
    validFrom: days(-350),
    validUntil: days(20), // expiring soon
    verifiedAt: days(-340),
  });
  const pending = await CertificationModel.create({
    orgId: String(brand._id),
    scheme: "PendingVerification",
    verificationStatus: "PendingVerification",
    certificateNumber: "APPLIED-2026-0091",
    certifyingBody: "TBD",
    scope: "Leafy greens (in conversion)",
  });

  // ── Products ────────────────────────────────────────────────────────────
  type Seed = {
    name: string;
    sku: string;
    barcode: string;
    categoryId: string;
    saleUnit: "kg" | "l" | "bunch" | "pack";
    baseUnit: "g" | "ml" | "count";
    basePerSaleUnit: number;
    taxRateBps: number;
    pricePaise: number;
    organicStatus: string;
    certificationId?: string;
  };
  const seeds: Seed[] = [
    { name: "Organic Tomatoes", sku: "GH-VEG-TOM", barcode: "8901000000011", categoryId: String(veg._id), saleUnit: "kg", baseUnit: "g", basePerSaleUnit: 1000, taxRateBps: 0, pricePaise: 6000, organicStatus: "Verified", certificationId: String(npop._id) },
    { name: "Organic Red Rice", sku: "GH-GRN-RRICE", barcode: "8901000000028", categoryId: String(grains._id), saleUnit: "kg", baseUnit: "g", basePerSaleUnit: 1000, taxRateBps: 0, pricePaise: 9500, organicStatus: "Verified", certificationId: String(npop._id) },
    { name: "Organic Cow Milk", sku: "GH-DRY-MILK", barcode: "8901000000035", categoryId: String(dairy._id), saleUnit: "l", baseUnit: "ml", basePerSaleUnit: 1000, taxRateBps: 0, pricePaise: 7200, organicStatus: "Verified", certificationId: String(pgsExpiring._id) },
    { name: "Organic Spinach Bunch", sku: "GH-VEG-SPIN", barcode: "8901000000042", categoryId: String(veg._id), saleUnit: "bunch", baseUnit: "count", basePerSaleUnit: 1, taxRateBps: 0, pricePaise: 3000, organicStatus: "InConversion", certificationId: String(pending._id) },
    { name: "Organic Groundnut Oil 1L", sku: "GH-GRO-GNO", barcode: "8901000000059", categoryId: String(grains._id), saleUnit: "pack", baseUnit: "count", basePerSaleUnit: 1, taxRateBps: 500, pricePaise: 38000, organicStatus: "Verified", certificationId: String(npop._id) },
    { name: "Organic Bananas", sku: "GH-FRT-BAN", barcode: "8901000000066", categoryId: String(fruit._id), saleUnit: "kg", baseUnit: "g", basePerSaleUnit: 1000, taxRateBps: 0, pricePaise: 8000, organicStatus: "Verified", certificationId: String(npop._id) },
  ];

  const products: HydratedDocument<IProduct>[] = [];
  for (const s of seeds) {
    const p = await ProductModel.create({
      orgId: String(brand._id),
      name: s.name,
      sku: s.sku,
      barcode: s.barcode,
      categoryId: s.categoryId,
      saleUnit: s.saleUnit,
      baseUnit: s.baseUnit,
      basePerSaleUnit: s.basePerSaleUnit,
      status: "active",
      certificationId: s.certificationId,
      organicStatus: s.organicStatus,
      taxRateBps: s.taxRateBps,
      basePricePaise: s.pricePaise,
      isPinned: ["GH-VEG-TOM", "GH-GRN-RRICE", "GH-DRY-MILK"].includes(s.sku),
    });
    await ProductPriceModel.create({
      orgId: String(brand._id),
      productId: String(p._id),
      locationId: String(loc1._id),
      unitPricePaise: s.pricePaise,
      effectiveFrom: days(-30),
      isActive: true,
    });
    products.push(p);
  }

  // ── Lots + opening inventory (into GHBR1) ───────────────────────────────
  async function receiveLot(
    product: (typeof products)[number],
    lotCode: string,
    qtyBase: number,
    expiry: Date,
    producerName: string,
  ) {
    let certSnapshot;
    if (product.certificationId) {
      const c = await CertificationModel.findById(product.certificationId).lean();
      if (c) {
        const now = Date.now();
        certSnapshot = {
          certificationId: String(c._id),
          scheme: c.scheme,
          verificationStatus: c.verificationStatus,
          certificateNumber: c.certificateNumber,
          certifyingBody: c.certifyingBody,
          validUntil: c.validUntil,
          isVerifiedOrganic:
            c.verificationStatus === "Approved" &&
            (!c.validUntil || new Date(c.validUntil).getTime() > now),
        };
      }
    }
    const lot = await LotModel.create({
      orgId: String(brand._id),
      productId: String(product._id),
      lotCode,
      receivedBase: qtyBase,
      receivedUnit: product.saleUnit,
      status: "active",
      producerName,
      fpoName: producerName.includes("FPO") ? "Araku Valley Organic FPO" : undefined,
      harvestDate: days(-6),
      packingDate: days(-4),
      expiryDate: expiry,
      certificationSnapshot: certSnapshot,
      receivedBy: "seed",
      receivedAtLocationId: String(loc1._id),
    });
    await InventoryBalanceModel.create({
      orgId: String(brand._id),
      locationId: String(loc1._id),
      productId: String(product._id),
      lotId: String(lot._id),
      availableBase: qtyBase,
      reservedBase: 0,
    });
    await StockMovementModel.create({
      orgId: String(brand._id),
      locationId: String(loc1._id),
      productId: String(product._id),
      lotId: String(lot._id),
      type: "opening",
      deltaBase: qtyBase,
      balanceAfterBase: qtyBase,
      refType: "Lot",
      refId: String(lot._id),
      actorId: "seed",
      note: `Opening balance for ${lotCode}`,
    });
    return lot;
  }

  // Two lots per staple, different expiry dates.
  await receiveLot(products[0], "TOM-A", 40_000, days(3), "Ravi Kumar Organic Farm");
  await receiveLot(products[0], "TOM-B", 25_000, days(9), "Araku Valley Organic FPO");
  await receiveLot(products[1], "RRICE-A", 120_000, days(180), "Araku Valley Organic FPO");
  await receiveLot(products[2], "MILK-A", 30_000, days(4), "Green Harvest Dairy Unit");
  await receiveLot(products[3], "SPIN-A", 50, days(2), "Green Harvest Kitchen Garden");
  await receiveLot(products[4], "GNO-A", 60, days(240), "Green Harvest Oil Mill");
  await receiveLot(products[5], "BAN-A", 35_000, days(6), "Ravi Kumar Organic Farm");

  // ── One demo sale via the real service (proves the transactional path) ──
  let demoSaleNote = "skipped";
  try {
    const openSession = await PosSessionModel.create({
      orgId: String(brand._id),
      locationId: String(loc1._id),
      registerId: String(reg1._id),
      openedBy: String(cashierUser._id),
      openedAt: new Date(),
      openingCashPaise: 200000,
      status: "open",
      totals: { ...EMPTY_TOTALS },
    });
    const cashierToken: PosTokenPayload = {
      sub: String(cashierUser._id),
      email: cashierUser.email,
      name: cashierUser.name,
      role: "Cashier",
      orgId: String(brand._id),
      orgType: "Brand",
      locationId: String(loc1._id),
    };
    // Tomatoes 1.5 kg + Red Rice 2 kg, both zero-tax → exact cash total.
    const total =
      Math.round((1.5 * products[0].basePricePaise!) ) +
      Math.round((2 * products[1].basePricePaise!));
    const { sale } = await createSale(cashierToken, {
      idempotencyKey: `seed-${randomBytes(6).toString("hex")}`,
      sessionId: String(openSession._id),
      items: [
        { productId: String(products[0]._id), qty: 1.5, saleUnit: "kg" },
        { productId: String(products[1]._id), qty: 2, saleUnit: "kg" },
      ],
      payments: [{ method: "cash", amountPaise: total }],
    });
    demoSaleNote = sale.receiptNo;
  } catch (e) {
    demoSaleNote = `skipped (${(e as Error).message})`;
  }

  // ── Report ─────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  console.log("Seed complete. Development credentials:\n");
  const table = [
    ["Admin", creds.admin.email, creds.admin.password],
    ["Owner", creds.owner.email, creds.owner.password],
    ["Manager", creds.manager.email, creds.manager.password],
    ["Cashier", creds.cashier.email, creds.cashier.password],
    ["InventoryManager", creds.inventory.email, creds.inventory.password],
  ];
  for (const [role, email, pw] of table) {
    console.log(`  ${role.padEnd(17)} ${email.padEnd(32)} ${pw}`);
  }
  console.log(`\n  Brand org : ${brand.name} (${brand._id})`);
  console.log(`  FPO org   : ${fpo.name}`);
  console.log(`  Farmer org: ${farmer.name}`);
  console.log(`  Locations : GHBR1 (${loc1._id}), GHMVP (${loc2._id})`);
  console.log(`  Products  : ${products.length}   Demo sale: ${demoSaleNote}`);
  console.log("─────────────────────────────────────────────\n");

  // Let the fire-and-forget audit write from the demo sale settle before closing.
  await new Promise((r) => setTimeout(r, 400));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
