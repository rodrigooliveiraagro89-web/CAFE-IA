type AgrynBrandProps = {
  compact?: boolean;
  inverted?: boolean;
};

export function AgrynBrand({ compact = false, inverted = false }: AgrynBrandProps) {
  const markUrl = `${import.meta.env.BASE_URL}brand/agryn-mark.svg`;

  return (
    <div className="agryn-brand" data-compact={compact} data-inverted={inverted}>
      <img src={markUrl} alt="" width="46" height="46" />
      {!compact && (
        <span>
          <strong>AGRYN</strong>
          <small>Inteligência que cultiva resultados</small>
        </span>
      )}
    </div>
  );
}
