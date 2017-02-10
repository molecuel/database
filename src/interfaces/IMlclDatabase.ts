export interface IMlclDatabase {
  type;
  layer?;
  connect();
  save();
  update();
  find();
}
