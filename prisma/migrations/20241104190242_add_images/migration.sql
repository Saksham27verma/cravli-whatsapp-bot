-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "age" TEXT,
    "gender" TEXT,
    "weight" TEXT,
    "height" TEXT,
    "activity_level" TEXT,
    "dietary_preferences" TEXT,
    "allergies" TEXT,
    "health_goals" TEXT,
    "current_health_conditions" TEXT,
    "daily_calorie_intake_goal" TEXT,
    "preferred_cuisines" TEXT,
    "meal_type_preferences" TEXT,
    "snack_preferences" TEXT,
    "disliked_ingredients" TEXT,
    "favorite_ingredients" TEXT,
    "meal_timing_preferences" TEXT,
    "number_of_meals_per_day" TEXT,
    "meal_prep_frequency" TEXT,
    "cooking_skill_level" TEXT,
    "budget_for_ingredients" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "isFood" BOOLEAN NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
