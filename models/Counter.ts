import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});

const Counter =
  (mongoose.models.Counter as mongoose.Model<{ _id: string; seq: number }>) ||
  mongoose.model("Counter", CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter!.seq;
}

export default Counter;
