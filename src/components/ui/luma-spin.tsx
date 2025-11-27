export const LumaSpin = () => {
  return (
    <div className="relative w-[65px] aspect-square">
      <span className="absolute rounded-[50px] animate-luma-spin shadow-[inset_0_0_0_3px] shadow-foreground" />
      <span className="absolute rounded-[50px] animate-luma-spin [animation-delay:-1.25s] shadow-[inset_0_0_0_3px] shadow-foreground" />
    </div>
  );
};
