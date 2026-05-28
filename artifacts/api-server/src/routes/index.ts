import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import photosRouter from "./photos";
import aiRouter from "./ai";
import storageRouter from "./storage";
import dashboardRouter from "./dashboard";
import personaRouter from "./persona";
import scobyRouter from "./scoby";
import bottleTestsRouter from "./bottle-tests";
import laduRouter from "./ladu";
import brewsRouter from "./brews";
import fermentationsRouter from "./fermentations";
import flavoringRouter from "./flavoring";
import backupsRouter from "./backups";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(photosRouter);
router.use(aiRouter);
router.use(storageRouter);
router.use(dashboardRouter);
router.use(personaRouter);
router.use(scobyRouter);
router.use(bottleTestsRouter);
router.use(laduRouter);
router.use(brewsRouter);
router.use(fermentationsRouter);
router.use(flavoringRouter);
router.use(backupsRouter);
router.use(adminRouter);

export default router;
