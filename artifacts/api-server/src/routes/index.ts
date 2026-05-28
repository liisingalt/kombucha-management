import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import batchesRouter from "./batches";
import logsRouter from "./logs";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(batchesRouter);
router.use(logsRouter);
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

export default router;
